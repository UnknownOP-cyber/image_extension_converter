document.getElementById('convertBtn').addEventListener('click', () => {
  const input = document.getElementById('imageInput');
  const format = document.getElementById('formatSelect').value;

  if (!input.files || !input.files[0]) {
    alert('Please select an image file first.');
    return;
  }

  const file = input.files[0];
  const reader = new FileReader();

  reader.onload = (event) => {
    const img = new Image();
    
    img.onload = () => {
      // 1. Draw image on an offscreen HTML5 canvas
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;

      const ctx = canvas.getContext('2d');
      
      // Handle transparent backgrounds when converting PNG/WebP to JPEG
      if (format === 'image/jpeg') {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      
      ctx.drawImage(img, 0, 0);

      // 2. Export converted image blob and trigger download
      canvas.toBlob((blob) => {
        if (!blob) return;

        const extension = format.split('/')[1];
        const fileName = file.name.substring(0, file.name.lastIndexOf('.')) + '.' + extension;
        
        const downloadLink = document.createElement('a');
        downloadLink.href = URL.createObjectURL(blob);
        downloadLink.download = fileName;
        downloadLink.click();

        URL.revokeObjectURL(downloadLink.href);
      }, format, 0.92); // 0.92 is output quality for JPEG/WebP
    };

    img.src = event.target.result;
  };

  reader.readAsDataURL(file);
});