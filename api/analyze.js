// api/analyze.js
// Đây là Edge Function, chạy trên môi trường Vercel (dùng mã Node.js)

import { GoogleGenAI } from '@google/genai';

// Khóa API được lấy từ Biến môi trường (Environment Variable) của Vercel
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Cấu trúc JSON bắt buộc (Lấy từ frontend)
const RESPONSE_SCHEMA = {
    type: "OBJECT",
    properties: {
        analysis: {
            type: "OBJECT",
            properties: {
                principalStatus: { type: "STRING", description: "Tình trạng chính (ví dụ: Thận Dương hư)."},
                cooperativeStatuses: { type: "ARRAY", items: { type: "STRING" }, description: "Các tình trạng phối hợp (nếu có ≥2 triệu chứng)."},
                combinedStatus: { type: "STRING", description: "Kết quả tổng hợp nếu có 3 nhóm trở lên cùng yếu (ví dụ: Thận hư tổng hợp + Tỳ dương hư + Tâm huyết hư)."}
            },
            propertyOrdering: ["principalStatus", "cooperativeStatuses", "combinedStatus"]
        },
        results: {
            type: "OBJECT",
            properties: {
                trieuChung: { type: "ARRAY", items: { type: "STRING" }, description: "Hiển thị lại các triệu chứng đã chọn/nhập, kèm phân loại Đông y."},
                ketLuan: { type: "STRING", description: "Tóm tắt tình trạng tổng quát, phân tích rõ nhóm chính và các nhóm phối hợp."},
                huongHoTro: { type: "STRING", description: "Đề xuất HƯỚNG giải pháp/phương pháp điều trị phù hợp theo từng nhóm."},
                goiYSanPham: { type: "STRING", description: "Đề xuất sản phẩm cụ thể (Viên bổ thận âm, Viên bổ thận dương, Bổ Tỳ hoàn) dựa trên phân tích tình trạng bệnh."},
                cachDung: { type: "STRING", description: "Hướng dẫn liều lượng cơ bản theo ngày/tháng và KIÊNG KỴ cho từng sản phẩm đã gợi ý."},
                anUongSinhHoat: { type: "STRING", description: "Liệt kê món ăn nên dùng, kiêng, thói quen tốt."}
            },
            propertyOrdering: ["trieuChung", "ketLuan", "huongHoTro", "goiYSanPham", "cachDung", "anUongSinhHoat"]
        }
    },
    propertyOrdering: ["analysis", "results"]
};

// Đảm bảo bạn đã cài đặt SDK @google/genai: npm install @google/genai
export default async function handler(request) {
    if (request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405 });
    }

    if (!GEMINI_API_KEY) {
        return new Response(JSON.stringify({ error: 'API Key not configured.' }), { status: 500 });
    }

    try {
        const { systemPrompt, contentParts } = await request.json();

        // Khởi tạo GenAI với khóa API an toàn
        const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
        
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-05-20",
            contents: [{ parts: contentParts }],
            config: {
                systemInstruction: { parts: [{ text: systemPrompt }] },
                responseMimeType: "application/json",
                responseSchema: RESPONSE_SCHEMA
            }
        });

        // Trích xuất và trả về kết quả JSON
        const jsonResponse = response.candidates?.[0]?.content?.parts?.[0]?.text;
        
        return new Response(jsonResponse, {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error('Gemini API Error:', error);
        return new Response(JSON.stringify({ error: 'Internal Server Error during AI analysis.' }), { status: 500 });
    }
}
