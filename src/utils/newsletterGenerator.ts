import html2canvas from 'html2canvas';

export async function generateNewsletterPDF() {
  const element = document.getElementById('newsletter-content');

  if (!element) {
    throw new Error('Newsletter content not found');
  }

  const wasHidden = element.classList.contains('hidden');
  if (wasHidden) {
    element.classList.remove('hidden');
  }

  try {
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      allowTaint: true,
    });

    const image = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = image;
    link.download = `Paparazzi-Newsletter-${new Date().toISOString().split('T')[0]}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } finally {
    if (wasHidden) {
      element.classList.add('hidden');
    }
  }
}
