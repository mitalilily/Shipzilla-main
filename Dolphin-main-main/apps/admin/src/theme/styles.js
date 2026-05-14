import { mode } from '@chakra-ui/theme-tools'
import { adminBrand } from './brand'
import colors from './foundations/colors'

export const globalStyles = {
  colors: {
    ...colors,
  },
  styles: {
    global: (props) => ({
      body: {
        bg: mode(adminBrand.page, '#171036')(props),
        color: mode('gray.900', 'whiteAlpha.900')(props),
        fontFamily: "'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif",
        backgroundImage: mode(
          adminBrand.pageGradient,
          'radial-gradient(circle at 8% 6%, rgba(93,35,148,0.22) 0%, transparent 26%), radial-gradient(circle at 92% 4%, rgba(86,232,19,0.10) 0%, transparent 24%), linear-gradient(180deg, #171036 0%, #241039 100%)',
        ),
        backgroundAttachment: 'fixed',
      },
      html: {
        fontFamily: "'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif",
        bg: mode(adminBrand.page, '#171036')(props),
      },
      '#root': {
        minHeight: '100vh',
      },
      '*': {
        boxSizing: 'border-box',
      },
      '::selection': {
        background: mode('brand.200', 'brand.600')(props),
      },
      '::-webkit-scrollbar': {
        width: '10px',
        height: '10px',
      },
      '::-webkit-scrollbar-track': {
        background: mode('rgba(93,35,148,0.06)', 'rgba(255,255,255,0.06)')(props),
      },
      '::-webkit-scrollbar-thumb': {
        background: mode('rgba(93,35,148,0.24)', 'rgba(255,255,255,0.22)')(props),
        borderRadius: '999px',
      },
    }),
  },
}
