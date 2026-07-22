import { createTheme } from '@mui/material/styles';

export const muiTheme = createTheme({
  palette: {
    primary: { main: '#2f5bff' },
    secondary: { main: '#11172f' },
    success: { main: '#1f7a45' },
    error: { main: '#a1262f' },
    background: { default: '#f7f8fb', paper: '#ffffff' },
    text: { primary: '#11172f', secondary: '#5a6478' }
  },
  typography: {
    fontFamily: 'Inter, system-ui, sans-serif',
    button: { textTransform: 'none', fontWeight: 700 }
  },
  shape: { borderRadius: 8 },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 8 }
      }
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 700 }
      }
    }
  }
});
