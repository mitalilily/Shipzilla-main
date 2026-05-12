import { createTheme } from "@mui/material/styles";

const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#5d2394",
      dark: "#43166d",
      light: "#7a3db4",
    },
    secondary: {
      main: "#56e813",
      dark: "#36b309",
      light: "#8cf45a",
    },
    success: {
      main: "#1e9f5b",
    },
    warning: {
      main: "#e2a000",
    },
    background: {
      default: "#f7f5fb",
      paper: "#ffffff",
    },
    text: {
      primary: "#1d1730",
      secondary: "#655c79",
    },
  },
  typography: {
    fontFamily: '"Plus Jakarta Sans", sans-serif',
    h1: {
      fontFamily: '"Space Grotesk", sans-serif',
      fontWeight: 700,
      letterSpacing: "-0.05em",
    },
    h2: {
      fontFamily: '"Space Grotesk", sans-serif',
      fontWeight: 700,
      letterSpacing: "-0.04em",
    },
    h3: {
      fontFamily: '"Space Grotesk", sans-serif',
      fontWeight: 700,
      letterSpacing: "-0.03em",
    },
    button: {
      fontWeight: 700,
      textTransform: "none",
    },
  },
  shape: {
    borderRadius: 20,
  },
  components: {
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          borderRadius: 999,
          paddingInline: 22,
          paddingBlock: 12,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
        },
      },
    },
  },
});

export default theme;
