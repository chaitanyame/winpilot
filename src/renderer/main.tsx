import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/globals.css';

// Add global error handler to catch and log errors
window.addEventListener('error', (event) => {
  console.error('[Global Error Handler]', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    error: event.error,
    stack: event.error?.stack
  });
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <App />
);
