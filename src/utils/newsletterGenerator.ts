import html2pdf from 'html2pdf.js';
import type { NewsItem } from '../types';

export async function generateNewsletterPDF(
  bollywoodNews: NewsItem[],
  tvNews: NewsItem[],
  hollywoodNews: NewsItem[]
) {
  const element = document.getElementById('newsletter-content');

  if (!element) {
    throw new Error('Newsletter content not found');
  }

  const opt = {
    margin: 10,
    filename: `Paparazzi-Newsletter-${new Date().toISOString().split('T')[0]}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2 },
    jsPDF: { orientation: 'portrait', unit: 'mm', format: 'a4' },
  };

  html2pdf().set(opt).from(element).save();
}
