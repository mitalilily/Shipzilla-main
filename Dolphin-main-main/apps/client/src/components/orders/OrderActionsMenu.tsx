import { alpha, Box, Button, Divider, ListItemIcon, ListItemText, Menu, MenuItem } from '@mui/material'
import { useState, type ReactNode } from 'react'
import { MdMoreVert } from 'react-icons/md'

export type OrderActionMenuItem = {
  key: string
  label: string
  icon?: ReactNode
  onClick: () => void
  disabled?: boolean
  danger?: boolean
  dividerBefore?: boolean
}

interface OrderActionsMenuProps {
  actions: OrderActionMenuItem[]
  label?: string
}

const OrderActionsMenu = ({ actions, label = 'Actions' }: OrderActionsMenuProps) => {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)
  const open = Boolean(anchorEl)
  const visibleActions = actions.length ? actions : [{ key: 'empty', label: 'No actions available', onClick: () => {}, disabled: true }]

  return (
    <>
      <Button
        size="small"
        variant="outlined"
        onClick={(event) => {
          event.stopPropagation()
          setAnchorEl(event.currentTarget)
        }}
        endIcon={<MdMoreVert size={16} />}
        sx={{
          minWidth: 120,
          height: 36,
          px: 1.5,
          borderRadius: 0,
          textTransform: 'none',
          fontWeight: 700,
          borderColor: alpha('#D66F3D', 0.34),
          color: '#D65A22',
          backgroundColor: '#FFFFFF',
          boxShadow: 'none',
          '&:hover': {
            borderColor: '#D66F3D',
            backgroundColor: alpha('#D66F3D', 0.04),
          },
        }}
      >
        {label}
      </Button>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={() => setAnchorEl(null)}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        PaperProps={{
          elevation: 0,
          sx: {
            mt: 0.75,
            minWidth: 250,
            borderRadius: 0,
            border: '1px solid rgba(29, 40, 66, 0.12)',
            boxShadow: '0 18px 36px rgba(29, 40, 66, 0.14)',
            overflow: 'hidden',
          },
        }}
        MenuListProps={{
          dense: true,
          sx: {
            p: 0.5,
          },
        }}
      >
        {visibleActions.map((action) => (
          <Box key={action.key}>
            {action.dividerBefore && <Divider sx={{ my: 0.5 }} />}
            <MenuItem
              disabled={action.disabled}
              onClick={(event) => {
                event.stopPropagation()
                setAnchorEl(null)
                action.onClick()
              }}
              sx={{
                borderRadius: 0,
                py: 1.1,
                px: 1.25,
                gap: 1,
                minHeight: 38,
                color: action.danger ? '#C0392B' : '#243146',
                '&:hover': {
                  backgroundColor: action.danger ? alpha('#C0392B', 0.08) : alpha('#D66F3D', 0.08),
                },
                '&.Mui-disabled': {
                  opacity: 0.45,
                },
              }}
            >
              {action.icon ? <ListItemIcon sx={{ minWidth: 28, color: 'inherit' }}>{action.icon}</ListItemIcon> : null}
              <ListItemText
                primary={action.label}
                primaryTypographyProps={{
                  fontSize: '0.84rem',
                  fontWeight: 600,
                }}
              />
            </MenuItem>
          </Box>
        ))}
      </Menu>
    </>
  )
}

export default OrderActionsMenu
