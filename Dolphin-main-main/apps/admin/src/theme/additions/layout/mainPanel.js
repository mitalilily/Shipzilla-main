const MainPanel = {
  baseStyle: {
    float: 'right',
    maxWidth: '100%',
    overflowX: 'hidden',
    overflowY: 'auto',
    position: 'relative',
    maxHeight: '100%',
    height: '100vh',
    overscrollBehavior: 'contain',
    WebkitOverflowScrolling: 'touch',
    scrollbarGutter: 'stable',
    transition: 'all 0.33s cubic-bezier(0.685, 0.0473, 0.346, 1)',
    transitionDuration: '.2s, .2s, .35s',
    transitionProperty: 'top, bottom, width',
    transitionTimingFunction: 'linear, linear, ease',
    background: 'transparent',
  },
  variants: {
    main: {
      float: 'right',
    },
    rtl: {
      float: 'left',
    },
  },
  defaultProps: {
    variant: 'main',
  },
}

export const MainPanelComponent = {
  components: {
    MainPanel,
  },
}
