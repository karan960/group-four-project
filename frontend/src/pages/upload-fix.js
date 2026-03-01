
// Updated handleBulkUpload function for DataManagement component
const handleBulkUpload = async () => {
  if (!excelFile) {
    setUploadStatus('Please select a file first');
    return;
  }

  try {
    setUploadStatus('Uploading...');
    const formData = new FormData();
    formData.append('file', excelFile);
    formData.append('type', activeTab);

    const response = await axios.post('http://localhost:5000/api/upload-excel', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });

    const { results } = response.data;
    setUploadStatus(`[OK] Upload successful! ${results.successful} records processed, ${results.failed} failed`);
    
    if (results.failed > 0) {
      setUploadStatus(prev => prev + '. Check console for details.');
      console.log('Upload errors:', results.errors);
    }
    
    setExcelFile(null);
    fetchData(); // Refresh data
  } catch (error) {
    setUploadStatus('[ERR] Upload failed: ' + (error.response?.data?.message || error.message));
  }
};
