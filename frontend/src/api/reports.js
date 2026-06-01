
export async function downloadReport(type, id) {
  const token = localStorage.getItem('token');
  const url = `http://localhost:8080/api/teacher/reports/${type}/${id}`;
 
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
 
  if (!response.ok) {
    throw new Error('Failed to download report');
  }
 
  const blob = await response.blob();
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = downloadUrl;
 
  const date = new Date().toISOString().split('T')[0];
  link.download = `EduEval_${type}_report_${date}.xlsx`;
 
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(downloadUrl);
}
 