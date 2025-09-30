import React, { useState, useMemo, useCallback } from 'react';
import { Leaf, ScrollText, Heart, Shield, Droplet, Sun, Moon, Zap, Loader2, Package, Camera } from 'lucide-react';

// --- Cấu hình API và logic liên quan đến Môi trường Canvas ---
// KHÔNG CẦN API KEY Ở ĐÂY NỮA, vì nó được gọi qua Edge Function
const API_ENDPOINT = '/api/analyze'; 

// --- Định nghĩa các nhóm triệu chứng Đông y (TCM) ---
const SYMPTOM_GROUPS = [
    {
        id: 'than_am_hu', title: 'Thận Âm hư', icon: Moon, color: 'text-blue-400', symptoms: [
            'Nóng bứt rứt, hay khát nước, miệng khô',
            'Đêm khó ngủ, dễ tỉnh giấc, hay mơ nhiều',
            'Lưng gối mỏi, ù tai, hoa mắt',
            'Đổ mồ hôi trộm ban đêm',
            'Lòng bàn tay – bàn chân nóng',
        ]
    },
    {
        id: 'than_duong_hu', title: 'Thận Dương hư', icon: Sun, color: 'text-red-400', symptoms: [
            'Lưng đau, gối lạnh, bụng dưới dễ lạnh',
            'Sợ lạnh, tay chân lạnh, mùa đông càng rõ',
            'Tiểu đêm nhiều lần, tiểu trong loãng',
            'Buổi sáng dậy mệt, thiếu sinh khí',
            'Sinh lý giảm, đau hông, xuất tinh sớm',
        ]
    },
    {
        id: 'than_khi_tinh_suy', title: 'Thận Khí hư / Tinh suy', icon: Zap, color: 'text-yellow-400', symptoms: [
            'Sinh lý yếu, ham muốn kém',
            'Xuất tinh sớm, di tinh, mộng tinh',
            'Mắt mờ, mỏi mắt, thính lực giảm',
            'Mệt mỏi, suy giảm trí nhớ, thiếu tập trung',
            'Đau hông, mỏi gối, sức bền kém',
        ]
    },
    {
        id: 'ty_khi_hu', title: 'Tỳ Khí hư', icon: Shield, color: 'text-green-400', symptoms: [
            'Ăn xong đầy bụng, khó tiêu, hay ợ hơi',
            'Bụng sôi òng ọc, phân lúc nát lúc táo',
            'Người mệt mỏi, da xanh, hay buồn ngủ sau ăn',
            'Ăn nhiều mà không hấp thu, khó lên cân',
            'Lưỡi nhợt, có dấu răng ở viền',
        ]
    },
    {
        id: 'ty_duong_hu', title: 'Tỳ Dương hư', icon: Droplet, color: 'text-orange-400', symptoms: [
            'Ăn xong lạnh bụng, dễ đi ngoài',
            'Lưỡi nhạt, rêu trắng dày',
            'Người sợ lạnh, bụng dưới dễ lạnh',
            'Ăn ít cũng đầy, khó tiêu lâu',
            'Dễ phù nề, mặt hay sưng',
        ]
    },
    {
        id: 'tam_huyet_khi_hu', title: 'Tâm Huyết hư / Khí hư', icon: Heart, color: 'text-pink-400', symptoms: [
            'Khó ngủ, hay hồi hộp, tim đập nhanh',
            'Sắc mặt nhợt nhạt, môi nhạt màu',
            'Hay quên, dễ lo âu, tinh thần kém',
            'Ngủ nhiều mà vẫn mệt',
            'Chóng mặt, váng đầu, hoa mắt',
        ]
    },
];

// Cấu trúc JSON không cần định nghĩa lại ở đây, chỉ cần dùng systemPrompt
// const RESPONSE_SCHEMA = { ... }; 

// --- Component Chính: App ---
const App = () => {
    const [checkedSymptoms, setCheckedSymptoms] = useState({});
    const [freeTextSymptoms, setFreeTextSymptoms] = useState('');
    const [tongueImage, setTongueImage] = useState(null); // Lưu Base64
    const [analysisResult, setAnalysisResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Xử lý thay đổi checkbox
    const handleCheckboxChange = useCallback((groupId, symptom) => {
        const key = `${groupId}|${symptom}`;
        setCheckedSymptoms(prev => ({
            ...prev,
            [key]: !prev[key],
        }));
    }, []);

    // Xử lý tải ảnh và chuyển thành Base64
    const handleImageUpload = (event) => {
        const file = event.target.files[0];
        if (file && file.size < 5 * 1024 * 1024) { // Giới hạn 5MB
            const reader = new FileReader();
            reader.onloadend = () => {
                setTongueImage(reader.result);
                setError('');
            };
            reader.readAsDataURL(file);
        } else if (file) {
            setError('Kích thước ảnh quá lớn. Vui lòng chọn ảnh dưới 5MB.');
            setTongueImage(null);
        }
    };

    // Danh sách triệu chứng đã chọn để gửi đi
    const selectedSymptomsList = useMemo(() => {
        return Object.keys(checkedSymptoms).filter(key => checkedSymptoms[key]).map(key => {
            const [groupId, symptom] = key.split('|');
            const groupTitle = SYMPTOM_GROUPS.find(g => g.id === groupId)?.title || 'Khác';
            return `${symptom} (${groupTitle})`;
        });
    }, [checkedSymptoms]);

    // Logic gọi API để phân tích triệu chứng
    const analyzeSymptoms = async () => {
        if (selectedSymptomsList.length === 0 && freeTextSymptoms.trim() === '' && !tongueImage) {
            setError('Vui lòng chọn, nhập ít nhất một triệu chứng, hoặc tải ảnh lưỡi.');
            return;
        }

        setLoading(true);
        setError('');
        setAnalysisResult(null);

        const allSymptoms = [...selectedSymptomsList, freeTextSymptoms.trim()].filter(s => s);
        const symptomListText = allSymptoms.join('; ');
        
        let userQuery = `Triệu chứng của tôi là: ${symptomListText}`;
        if (tongueImage) {
            userQuery += "\n\n(Lưu ý: Có kèm ảnh lưỡi đính kèm để phân tích thêm.)";
        }
        
        // Cấu trúc parts cho multi-modal
        const contentParts = [{ text: userQuery }];

        if (tongueImage) {
            try {
                const parts = tongueImage.split(',');
                const mimeTypePart = parts[0];
                const base64Data = parts[1];
                
                const mimeTypeMatch = mimeTypePart.match(/:(.*?);/);
                const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : 'image/jpeg'; 

                contentParts.push({
                    inlineData: {
                        mimeType: mimeType,
                        data: base64Data
                    }
                });
            } catch (e) {
                console.error("Error processing image:", e);
                setError('Lỗi xử lý ảnh. Vui lòng thử lại với ảnh khác.');
                setLoading(false);
                return;
            }
        }

        // System Prompt giữ nguyên (Edge Function sẽ sử dụng nó)
        const systemPrompt = `Bạn là một chuyên gia Đông y. Hãy phân tích các triệu chứng sau theo logic Thận Âm/Dương/Khí, Tỳ Khí/Dương, Tâm Huyết/Khí và đưa ra kết quả tuân thủ nghiêm ngặt theo các quy tắc:
        1. Gom triệu chứng vào từng nhóm Đông y.
        2. Nếu khách nhập tự do, hãy mapping (gán) triệu chứng đó vào nhóm phù hợp (ví dụ: "tóc rụng" -> Thận tinh suy).
        3. Nhóm nào có số lượng triệu chứng được gán nhiều nhất sẽ là TÌNH TRẠNG CHÍNH (Principal Status).
        4. Nhóm thứ 2 và thứ 3, nếu có ≥2 triệu chứng, được xem là PHỐI HỢP (Cooperative Statuses).
        5. Nếu có từ 3 nhóm trở lên cùng yếu (có triệu chứng) thì gọi là HƯ TỔNG HỢP (Combined Status), trong đó phải ghi rõ các nhóm yếu.
        6. Kết quả đầu ra PHẢI LÀ MỘT OBJECT JSON theo schema đã cung cấp.

        *LƯU Ý ĐẶC BIỆT:* Nếu có cung cấp HÌNH ẢNH LƯỠI, hãy sử dụng thông tin từ LƯỠI (màu sắc, rêu lưỡi, hình thái) để bổ sung và củng cố cho phần BIỆN CHỨNG trong KẾT LUẬN và HƯỚNG HỖ TRỢ.
        
        7. Dựa trên phân tích, hãy sử dụng các sản phẩm sau để gợi ý (chỉ dùng các sản phẩm này):
            A. Viên bổ thận âm (Thành phần: Thục địa, hoài sơn, sơn thủ, phục linh, hà thủ ô, trạch tà, đan bì, đảng sâm) - Hỗ trợ Thận Âm hư, tóc, xương khớp, kinh nguyệt, mồ hôi trộm, nóng trong. Liều dùng: Ngày 3 lần, 30 viên/lần sau ăn. Kiêng: Không ăn rau muống, giá đỗ, đậu xanh.
            B. Viên bổ thận dương (Thành phần: Thục địa, sơn thù, hoài sơn, ba kích, nhục thung dung, Dâm dương hoặc...) - Hỗ trợ Thận Dương hư, lạnh bụng, tiêu chảy, yếu sinh lý, tiểu đêm, chịu lạnh kém, da xanh. Liều dùng: Ngày 3 lần, 30 viên/lần sau ăn. Kiêng: Không ăn rau muống sống, giá đỗ, đậu xanh (vì giải thuốc).
            C. Bổ Tỳ hoàn (Dưỡng tâm - kiện tỳ) (Thành phần: đương quy, đảng sâm, hoàng kỳ, bạch truật, phục thần, viễn chí, long nhãn, đại táo...) - Hỗ trợ Tỳ Khí/Dương hư, Tâm Huyết/Khí hư. Dùng cho suy nhược, kém ăn, mất ngủ, hồi hộp, tiêu hóa kém, thiếu khí huyết. Liều dùng: Người lớn: Ngày 3 lần, 30 viên/lần tùy; Trẻ em (dưới 10 tuổi): Ngày 3 lần, 20 viên/lần trước ăn 30 phút. Kiêng: rau muống, giá đỗ, đậu xanh, nước đá lạnh. Trẻ em không uống được viên có thể nghiền ra thêm ít đường.

        8. Triển khai nội dung cho 5 phần kết quả (đã bỏ Tư vấn ngắn gọn), tuân thủ định dạng sau:
            - QUY TẮC ĐỊNH DẠNG CHUNG: Bắt buộc sử dụng Markdown **để in đậm** TÊN TÌNH TRẠNG (ví dụ: **Thận Dương hư**, **Tỳ khí hư**, **Khí huyết bất túc**) và TÊN SẢN PHẨM (ví dụ: **Viên bổ thận âm**, **Bổ Tỳ hoàn**) trong các phần KẾT LUẬN, HƯỚNG HỖ TRỢ, GỢI Ý SẢN PHẨM và CÁCH DÙNG để tăng tính thẩm mỹ và dễ đọc.
            - TRIEU CHUNG: Phải liệt kê TẤT CẢ các triệu chứng đã chọn và nhập tự do, mỗi triệu chứng là một mục gạch đầu dòng, viết theo định dạng: \`- [Triệu chứng] → [Giải thích/biện chứng ngắn gọn, dễ hiểu, kèm phân loại Đông y].\`
            - KET LUAN: Sử dụng xuống dòng kép (\n\n) để phân tách rõ ràng phần tóm tắt tổng quát và các điểm phân tích chi tiết.
            - HUONG HO TRO: Phải nêu rõ HƯỚNG điều trị theo Đông y. Cần biện chứng rõ ràng, chi tiết, và dễ hiểu. Sử dụng xuống dòng hợp lý (\n hoặc \n\n) để phân tách các ý lớn.
            - GOI Y SAN PHAM: Định dạng BẮT BUỘC: Danh sách gạch đầu dòng (-), mỗi sản phẩm trên một dòng, in đậm tên sản phẩm, kèm phân tích thành phần, tác dụng. Sử dụng ký tự xuống dòng \n để phân tách các mục.
            - CACH DUNG: Phải tóm tắt ĐẦY ĐỦ CÁCH DÙNG. Định dạng BẮT BUỘC: Mỗi câu/ý về liều dùng phải xuống dòng (\n). Sau khi liệt kê xong liều dùng, phải có một dòng phân cách '--- KIÊNG KỴ CHUNG ---' và sau đó là PHẦN KIÊNG KỴ TỔNG HỢP. Sử dụng ký tự xuống dòng \n để phân tách các câu/ý.
            - AN UONG – SINH HOAT: Định dạng BẮT BUỘC: Mỗi ý, mỗi câu phải xuống dòng. Sử dụng ký tự xuống dòng \n và dấu gạch đầu dòng (-) cho các ý liệt kê.

        Dựa vào các triệu chứng của bệnh nhân và hình ảnh lưỡi (nếu có), hãy thực hiện phân tích và điền vào các trường JSON.`;


        const payload = {
            systemPrompt: systemPrompt,
            contentParts: contentParts
        };

        try {
            // Logic cho exponential backoff
            const maxRetries = 3;
            let currentDelay = 1000;
            let response;
            
            for (let i = 0; i < maxRetries; i++) {
                // Gọi Edge Function thay vì gọi trực tiếp Gemini API
                response = await fetch(API_ENDPOINT, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (response.ok) {
                    break;
                }

                if (i < maxRetries - 1) {
                    await new Promise(resolve => setTimeout(resolve, currentDelay));
                    currentDelay *= 2;
                } else {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
            }
            
            if (!response.ok) {
                // Edge Function sẽ trả về JSON lỗi
                const errorBody = await response.json();
                throw new Error(`Edge Function failed: ${errorBody.error || response.statusText}`);
            }

            // Edge Function đã trả về JSON của kết quả phân tích
            const result = await response.json();
            
            // Xử lý kết quả trả về từ Edge Function (đã là JSON thuần)
            if (result.results) {
                 setAnalysisResult(result.results);
            } else {
                // Dùng response.json() vì Edge Function trả về JSON của result
                setAnalysisResult(result);
            }
            

        } catch (e) {
            console.error("Analysis Error:", e);
            setError(`Lỗi kết nối hoặc phân tích: ${e.message}. Vui lòng thử lại.`);
        } finally {
            setLoading(false);
        }
    };

    // --- Component con cho việc hiển thị kết quả ---
    // Sử dụng whitespace-pre-line để hiển thị đúng định dạng xuống dòng (\n). 
    // Chúng ta dựa vào AI để chèn Markdown BOLD (**) và xuống dòng hợp lý.
    const ResultSection = ({ title, content, Icon, colorClass }) => (
        <div className="p-4 bg-gray-800 rounded-xl shadow-lg mb-4 border border-yellow-700/50 transition-all duration-300 hover:shadow-yellow-500/20">
            <div className={`flex items-center mb-3 ${colorClass}`}>
                <Icon className="w-5 h-5 mr-3" />
                <h3 className="text-lg font-semibold text-yellow-500 uppercase">{title}</h3>
            </div>
            {/* Sử dụng div đơn giản để hiển thị Markdown. Tailwind CSS sẽ tự động căn chỉnh khoảng cách dòng (leading-relaxed) */}
            <div className="text-sm text-gray-300 leading-relaxed whitespace-pre-line">
                {/* Logic render Markdown BOLD và gạch đầu dòng */}
                {content && content.split('\n').map((line, index) => {
                    // Xử lý in đậm và gạch đầu dòng
                    let renderedLine = line;
                    
                    // 1. Xử lý gạch đầu dòng (nếu dòng bắt đầu bằng - )
                    if (renderedLine.trim().startsWith('-')) {
                         renderedLine = '<span class="mr-2 text-red-400">•</span> ' + renderedLine.trim().substring(1).trim();
                    }
                    
                    // 2. Xử lý in đậm Markdown (**)
                    renderedLine = renderedLine.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
                    
                    // 3. Xử lý mũi tên giải thích (→)
                    renderedLine = renderedLine.replace(/→/g, '<span class="text-yellow-500 mx-2">→</span>');

                    return <p key={index} dangerouslySetInnerHTML={{ __html: renderedLine }} className="mb-1 last:mb-0" />;
                })}
            </div>
        </div>
    );

    // --- Giao diện tổng thể ---
    return (
        <div className="min-h-screen bg-gray-900 text-gray-100 font-sans p-4 sm:p-6 md:p-8">
            <header className="text-center mb-8">
                <Leaf className="w-10 h-10 mx-auto text-red-500 mb-2" />
                <h1 className="text-3xl font-bold text-yellow-400">THẬN VÀ SỨC KHOẺ</h1>
                <p className="text-sm text-gray-400 mt-1">Chọn các triệu chứng ứng với sức khoẻ của bạn (Lưu ý: các triệu chứng hiện tại đang mắc phải, các triệu chứng lâu lâu mới bị một lần thì không tính vào).</p>
            </header>

            {/* Form CHECKLIST triệu chứng */}
            <div className="max-w-xl mx-auto mb-10 bg-gray-800 p-4 rounded-xl shadow-xl">
                <h2 className="text-xl font-semibold mb-4 text-red-400 border-b border-red-800 pb-2">1. Checklist Triệu Chứng</h2>
                
                {SYMPTOM_GROUPS.map(group => {
                    const Icon = group.icon;
                    return (
                        <div key={group.id} className="mb-6 p-3 border border-gray-700 rounded-lg bg-gray-700/50">
                            <div className={`flex items-center mb-3 ${group.color}`}>
                                <Icon className="w-4 h-4 mr-2" />
                                <h3 className="font-bold text-base">{group.title}</h3>
                            </div>
                            <div className="space-y-2">
                                {group.symptoms.map((symptom, index) => (
                                    <label key={index} className="flex items-start text-sm cursor-pointer hover:text-yellow-400 transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={checkedSymptoms[`${group.id}|${symptom}`] || false}
                                            onChange={() => handleCheckboxChange(group.id, symptom)}
                                            className="mt-1 w-4 h-4 text-red-500 bg-gray-900 border-gray-600 rounded focus:ring-red-500 focus:ring-2"
                                        />
                                        <span className="ml-2 text-gray-300">{symptom}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    );
                })}

                {/* Triệu chứng tự do và Ảnh Lưỡi */}
                <div className="mt-6 pt-4 border-t border-red-800">
                    <h3 className="font-bold text-red-400 mb-2">Các triệu chứng khác (Tự nhập)</h3>
                    <textarea
                        value={freeTextSymptoms}
                        onChange={(e) => setFreeTextSymptoms(e.target.value)}
                        placeholder="Ví dụ: 'gần sáng phải dậy tiểu 1 lần', 'bụng lạnh thì đi ngoài', 'tóc rụng'..."
                        rows="3"
                        className="w-full p-3 text-sm bg-gray-900 border border-gray-700 rounded-lg text-gray-200 focus:ring-yellow-500 focus:border-yellow-500"
                    />
                    
                    <h3 className="font-bold text-red-400 mb-2 mt-4 flex items-center">
                        <Camera className="w-4 h-4 mr-2" /> Thêm ảnh lưỡi (Biện chứng)
                    </h3>
                    <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-yellow-50 file:text-red-700 hover:file:bg-yellow-100"
                    />

                    {tongueImage && (
                        <div className="mt-3 p-3 bg-gray-700/70 rounded-lg">
                            <p className="text-xs text-yellow-400 mb-2">Ảnh lưỡi đã tải lên:</p>
                            <img 
                                src={tongueImage} 
                                alt="Ảnh lưỡi" 
                                className="w-full max-h-48 object-contain rounded border border-gray-600" 
                            />
                        </div>
                    )}
                </div>

                {/* Nút Xem kết quả */}
                <button
                    onClick={analyzeSymptoms}
                    disabled={loading}
                    className="w-full mt-6 py-3 px-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-lg transition-all duration-300 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {loading ? (
                        <>
                            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                            Đang phân tích...
                        </>
                    ) : (
                        'XEM KẾT QUẢ PHÂN TÍCH'
                    )}
                </button>

                {error && (
                    <div className="mt-4 p-3 bg-red-900/50 border border-red-700 text-red-300 rounded-lg text-sm">
                        ⚠️ {error}
                    </div>
                )}
            </div>
            
            {/* Khu vực HIỂN THỊ KẾT QUẢ */}
            {analysisResult && (
                <div className="max-w-xl mx-auto mt-10 p-6 bg-gray-950 rounded-2xl shadow-2xl border-2 border-yellow-700">
                    <h2 className="text-2xl font-bold mb-6 text-yellow-400 text-center border-b-2 border-red-600 pb-3">2. KẾT QUẢ ĐÔNG Y BIỆN CHỨNG</h2>
                    
                    {/* Triệu chứng: Hiển thị danh sách triệu chứng và đảm bảo có gạch đầu dòng */}
                    <ResultSection
                        title="Triệu chứng"
                        content={analysisResult.trieuChung.map(s => `${s}`).join('\n')}
                        Icon={ScrollText}
                        colorClass="text-red-400"
                    />
                    
                    <ResultSection
                        title="Kết luận"
                        content={analysisResult.ketLuan}
                        Icon={Leaf}
                        colorClass="text-yellow-400"
                    />

                    <ResultSection
                        title="Hướng hỗ trợ"
                        content={analysisResult.huongHoTro}
                        Icon={Heart}
                        colorClass="text-pink-400"
                    />
                    
                    <ResultSection
                        title="Gợi ý sản phẩm"
                        content={analysisResult.goiYSanPham}
                        Icon={Package}
                        colorClass="text-orange-300"
                    />

                    <ResultSection
                        title="Cách dùng"
                        content={analysisResult.cachDung}
                        Icon={Shield}
                        colorClass="text-blue-400"
                    />

                    <ResultSection
                        title="Ăn uống – Sinh hoạt"
                        content={analysisResult.anUongSinhHoat}
                        Icon={Droplet}
                        colorClass="text-green-400"
                    />
                </div>
            )}

            {/* Phần Mua hàng - Thêm mới */}
            {analysisResult && (
                <div className="max-w-xl mx-auto mt-8 p-4 bg-red-800/20 border border-red-700 rounded-xl text-center shadow-inner">
                    <p className="text-lg font-bold text-red-400 mb-3">
                        🛍️ ĐẶT MUA SẢN PHẨM PHÙ HỢP
                    </p>
                    <p className="text-sm text-gray-300 mb-4">
                        Xem ngay trang trưng bày của **Thận & Sức Khoẻ** trên TikTok và chọn sản phẩm phù hợp với bạn:
                    </p>
                    <a 
                        href="https://vt.tiktok.com/ZSHWXPaQcUR8S-oPwej/" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-block py-2 px-6 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition duration-200 shadow-md transform hover:scale-105"
                    >
                        Truy Cập Trang Mua Hàng TikTok
                    </a>
                </div>
            )}
            <footer className="text-center text-xs text-gray-600 mt-10">
                Nếu không thấy mua được qua tiktok thì mọi người có thể đặt hàng qua Zalo: 
                <a href="https://zalo.me/0392938357" target="_blank" rel="noopener noreferrer" className="text-yellow-400 ml-1 hover:underline">
                    https://zalo.me/0392938357
                </a>
            </footer>
        </div>
    );
};

export default App;
