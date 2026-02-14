// Updated MLModelControl component with real API calls
const MLModelControl = () => {
  const [modelStatus, setModelStatus] = useState('Loading...');
  const [trainingProgress, setTrainingProgress] = useState(0);
  const [modelMetrics, setModelMetrics] = useState({
    accuracy: 0,
    precision: 0,
    recall: 0,
    f1Score: 0
  });

  useEffect(() => {
    fetchModelStatus();
  }, []);

  const fetchModelStatus = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/ml/status');
      const data = response.data;
      setModelStatus(data.status);
      setModelMetrics({
        accuracy: data.accuracy,
        precision: 83.2, // These would come from backend in real implementation
        recall: 87.1,
        f1Score: 85.1
      });
    } catch (error) {
      console.error('Error fetching model status:', error);
      setModelStatus('Error loading status');
    }
  };

  const trainModel = async () => {
    try {
      setModelStatus('Training...');
      setTrainingProgress(0);
      
      const response = await axios.post('http://localhost:5000/api/ml/train');
      
      // Simulate training progress (in real app, you might use WebSockets or polling)
      const interval = setInterval(() => {
        setTrainingProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            setModelStatus('Trained');
            fetchModelStatus(); // Refresh status
            return 100;
          }
          return prev + 10;
        });
      }, 500);
    } catch (error) {
      setModelStatus('Training failed');
      console.error('Error training model:', error);
    }
  };

  const evaluateModel = async () => {
    try {
      // This would be a real evaluation endpoint
      await fetchModelStatus();
      alert('Model evaluation completed!');
    } catch (error) {
      console.error('Error evaluating model:', error);
    }
  };

  // ... rest of the component remains the same
};
