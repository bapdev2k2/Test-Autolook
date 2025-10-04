const file = document.getElementById('file');
const canvas = document.getElementById('main');
const ctx = canvas.getContext('2d');
const maskCanvas = document.getElementById('mask');
const maskCtx = maskCanvas.getContext('2d');
const size = document.getElementById('size');
const sizeVal = document.getElementById('sizeVal');
const colorSel = document.getElementById('markColor');
const btnUndo = document.getElementById('undo');
const btnReset = document.getElementById('reset');
const btnDownload = document.getElementById('download');
const btnPencil = document.getElementById('btnPencil');
const btnEraser = document.getElementById('btnEraser');
const btnFill = document.getElementById('btnFill');

let brush = parseInt(size.value, 10);
let markColor = colorSel.value;
let drawing = false;
let baseImage = null;
let imagePattern = null;
const history = [];
let currentTool = 'pencil'; // 'pencil', 'eraser', 'fill'
const cursor = document.getElementById('cursor');



function insideCanvas(e) {
  const rect = canvas.getBoundingClientRect();
  return (e.clientX >= rect.left && e.clientX <= rect.right &&
          e.clientY >= rect.top  && e.clientY <= rect.bottom);
}

// Quy đổi brush (px canvas) → px màn hình theo tỉ lệ scale CSS
function screenBrushPx() {
  const rect = canvas.getBoundingClientRect();
  const scaleX = rect.width  / canvas.width;
  // (scaleY thường bằng scaleX vì giữ tỉ lệ; nếu khác thì lấy trung bình)
  return Math.max(2, Math.round(brush * scaleX)); // tối thiểu 2px cho dễ nhìn
}

function updateCursorSize() {
  const s = screenBrushPx();
  cursor.style.width  = s + 'px';
  cursor.style.height = s + 'px';
}

function updateCursorPos(e) {
  cursor.style.left = e.clientX + 'px';
  cursor.style.top  = e.clientY + 'px';
}


// Cập nhật kích thước khi đổi size brush
size.addEventListener('input', () => {
  brush = parseInt(size.value, 10);
  sizeVal.textContent = brush;
  updateCursorSize();
});
canvas.addEventListener('mouseenter', () => {
  updateCursorSize();
  cursor.style.display = 'block';
});
canvas.addEventListener('mouseleave', () => {
  cursor.style.display = 'none';
});

// theo dõi toàn cục để không bị "tụt" khi chuột đi nhanh
document.addEventListener('mousemove', (e) => {
  if (insideCanvas(e)) {
    if (cursor.style.display !== 'block') cursor.style.display = 'block';
    updateCursorPos(e);
  } else {
    if (cursor.style.display !== 'none') cursor.style.display = 'none';
  }
});
window.addEventListener('resize', updateCursorSize);




// --- CÁC HÀM TIỆN ÍCH VÀ KHỞI TẠO ---

size.addEventListener('input', () => {
    brush = parseInt(size.value, 10);
    sizeVal.textContent = brush;
});
colorSel.addEventListener('change', () => markColor = colorSel.value);

const pushHistory = () => {
    try {
        history.push(canvas.toDataURL());
        if (history.length > 20) history.shift();
    } catch (e) { console.error("Failed to push history:", e); }
};

const resizeCanvas = (img) => {
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    maskCanvas.width = img.naturalWidth;
    maskCanvas.height = img.naturalHeight;
};

const drawImageFit = (img) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
    maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
};

file.addEventListener('change', (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    const img = new Image();
    img.onload = () => {
        baseImage = img;
        resizeCanvas(img);
        drawImageFit(img);
        imagePattern = ctx.createPattern(baseImage, 'no-repeat');
        pushHistory();
        URL.revokeObjectURL(url);
        setActiveTool('pencil');
    };
    img.src = url;
});

// --- LOGIC QUẢN LÝ CÔNG CỤ ---

const setActiveTool = (tool) => {
    currentTool = tool;
    const toolButtons = { pencil: btnPencil, eraser: btnEraser, fill: btnFill };
    Object.values(toolButtons).forEach(btn => {
        btn.classList.remove('bg-[#30475e]', 'text-white');
        btn.classList.add('opacity-100');
    });
    if (toolButtons[tool]) {
        toolButtons[tool].classList.add('bg-[#30475e]', 'text-white');
        toolButtons[tool].classList.remove('opacity-100');
    }

    cursor.className = (tool === 'fill') ? 'brush-cursor-square' : 'brush-cursor';
  updateCursorSize();
};

btnPencil.addEventListener('click', () => setActiveTool('pencil'));
btnEraser.addEventListener('click', () => setActiveTool('eraser'));
btnFill.addEventListener('click', () => setActiveTool('fill'));

// --- LOGIC VẼ VÀ TÔ MÀU ---

const pointerPos = (evt) => {
    const rect = canvas.getBoundingClientRect();
    const x = Math.round((evt.clientX - rect.left) * (canvas.width / rect.width));
    const y = Math.round((evt.clientY - rect.top) * (canvas.height / rect.height));
    return { x, y };
};

const beginStroke = (x, y) => {
    pushHistory();
    ctx.lineCap = ctx.lineJoin = 'round';
    ctx.lineWidth = brush;
    maskCtx.lineCap = maskCtx.lineJoin = 'round';
    maskCtx.lineWidth = brush;

    if (currentTool === 'pencil') {
        ctx.globalCompositeOperation = 'destination-out';
        maskCtx.globalCompositeOperation = 'source-over';
        maskCtx.strokeStyle = markColor;
    } else if (currentTool === 'eraser') {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = imagePattern;
        maskCtx.globalCompositeOperation = 'destination-out';
    }

    ctx.beginPath(); ctx.moveTo(x, y);
    maskCtx.beginPath(); maskCtx.moveTo(x, y);
};

const continueStroke = (x, y) => {
    ctx.lineTo(x, y); ctx.stroke();
    maskCtx.lineTo(x, y); maskCtx.stroke();
};

const endStroke = () => {
    ctx.closePath();
    maskCtx.closePath();
    ctx.globalCompositeOperation = 'source-over';
};

const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
};

const startInteraction = (e) => {
    if (!baseImage) return;
    const { x, y } = pointerPos(e.touches ? e.touches[0] : e);

    if (currentTool === 'pencil' || currentTool === 'eraser') {
        drawing = true;
        beginStroke(x, y);
    } else if (currentTool === 'fill') {
        floodFill(x, y);
    }
};

const moveInteraction = (e) => {
    if (!drawing) return;
    const { x, y } = pointerPos(e.touches ? e.touches[0] : e);
    continueStroke(x, y);
};

const stopInteraction = () => {
    if (drawing) {
        drawing = false;
        endStroke();
    }
};

// --- EVENT LISTENERS ---
canvas.addEventListener('mousedown', startInteraction);
window.addEventListener('mousemove', moveInteraction);
window.addEventListener('mouseup', stopInteraction);
canvas.addEventListener('touchstart', (e) => { e.preventDefault(); startInteraction(e); }, { passive: false });
canvas.addEventListener('touchmove', (e) => { e.preventDefault(); moveInteraction(e); }, { passive: false });
window.addEventListener('touchend', stopInteraction);

// --- CÁC NÚT CHỨC NĂNG KHÁC ---
btnUndo.onclick = () => {
    if (!history.length) return;
    const prev = history.pop();
    const img = new Image();
    img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
    };
    img.src = prev;
};

btnReset.onclick = () => {
    if (!baseImage) return;
    drawImageFit(baseImage);
    pushHistory();
};

btnDownload.onclick = () => {
    if (!canvas.width) return;
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = "erased.png";
    a.click();
};

setActiveTool('pencil');


// Hiển thị con trỏ khi di chuyển trong canvas
canvas.addEventListener('mouseenter', () => { cursor.style.display = 'block'; });
canvas.addEventListener('mouseleave', () => { cursor.style.display = 'none'; });

if (tool === 'fill') {
  cursor.className = 'brush-cursor-square';
} else {
  cursor.className = 'brush-cursor';
}
updateCursorSize();