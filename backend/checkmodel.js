// Nhớ import cấu hình dotenv nếu bạn chạy file này chung với project
require('dotenv').config();

const API_KEY = process.env.GEMINI_API_KEY;

async function checkAvailableGeminiModels() {
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`API báo lỗi! Status: ${response.status}`);
    }
    
    const data = await response.json();
    
    console.log("=== DANH SÁCH GEMINI MODELS KHẢ DỤNG ===");
    
    // Lặp qua mảng model và in ra các thông tin hữu ích nhất
    data.models.forEach(model => {
      console.log(`🔹 Tên hiển thị: ${model.displayName}`);
      console.log(`   - ID Model (Dùng để code): ${model.name.replace('models/', '')}`);
      console.log(`   - Giới hạn Token (In/Out): ${model.inputTokenLimit} / ${model.outputTokenLimit}`);
      console.log(`   - Hàm hỗ trợ: ${model.supportedGenerationMethods.join(', ')}\n`);
    });

  } catch (error) {
    console.error("❌ Lỗi khi quét model:", error.message);
  }
}

checkAvailableGeminiModels();