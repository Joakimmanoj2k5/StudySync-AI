import { StudyProvider } from './context/StudyContext';
import { Dashboard } from './components/Dashboard';

function App() {
  return (
    <StudyProvider>
      <Dashboard />
    </StudyProvider>
  );
}

export default App;
