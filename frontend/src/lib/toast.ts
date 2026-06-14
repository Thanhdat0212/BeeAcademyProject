import toast from 'react-hot-toast';

export const notify = {
  success: (message: string) => {
    toast.success(message, {
      duration: 3000,
      position: 'top-center',
      style: {
        background: '#10B981', // green-500
        color: '#fff',
        fontWeight: 'bold',
        padding: '16px',
        borderRadius: '12px',
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
      },
      iconTheme: {
        primary: '#fff',
        secondary: '#10B981',
      },
    });
  },
  
  error: (message: string) => {
    toast.error(message, {
      duration: 4000,
      position: 'top-center',
      style: {
        background: '#EF4444', // red-500
        color: '#fff',
        fontWeight: 'bold',
        padding: '16px',
        borderRadius: '12px',
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
      },
      iconTheme: {
        primary: '#fff',
        secondary: '#EF4444',
      },
    });
  },

  info: (message: string) => {
    toast(message, {
      duration: 3000,
      position: 'top-center',
      style: {
        background: '#3B82F6', // blue-500
        color: '#fff',
        fontWeight: 'bold',
        padding: '16px',
        borderRadius: '12px',
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
      },
    });
  },
  
  loading: (message: string) => {
    return toast.loading(message, {
      position: 'top-center',
      style: {
        background: '#374151', // gray-700
        color: '#fff',
        fontWeight: 'bold',
        padding: '16px',
        borderRadius: '12px',
      },
    });
  },

  dismiss: (toastId?: string) => {
    toast.dismiss(toastId);
  }
};
