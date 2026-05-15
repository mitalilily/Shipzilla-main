import { SearchIcon } from '@chakra-ui/icons'
import {
  Box,
  Button,
  Flex,
  IconButton,
  Input,
  InputGroup,
  InputLeftElement,
  Popover,
  PopoverArrow,
  PopoverBody,
  PopoverContent,
  PopoverTrigger,
  Text,
  useColorModeValue,
} from '@chakra-ui/react'
import { IconLogout } from '@tabler/icons-react'
import { SettingsIcon } from 'components/Icons/Icons'
import SidebarResponsive from 'components/Sidebar/SidebarResponsive'
import PropTypes from 'prop-types'
import { useRef } from 'react'
import routes from 'routes.js'
import { useAuthStore } from 'store/useAuthStore'
import { adminBrand } from 'theme/brand'
import NotificationMenu from './NotificationMenu'

export default function HeaderLinks({ variant, children, fixed, secondary, onOpen, ...rest }) {
  const settingsRef = useRef()
  const { isLoggedIn, logout } = useAuthStore()
  const inputBg = useColorModeValue('rgba(255, 255, 255, 0.74)', 'rgba(255, 255, 255, 0.78)')
  const inputBorder = useColorModeValue('rgba(93,35,148,0.16)', 'rgba(93,35,148,0.18)')
  const hoverBg = useColorModeValue('rgba(93,35,148,0.08)', 'rgba(93,35,148,0.1)')
  const placeholder = useColorModeValue('gray.400', 'gray.500')

  const styles = {
    accent: adminBrand.primary,
    accentSecondary: adminBrand.primaryLight,
    accentSky: adminBrand.secondaryDark,
    accentSuccess: adminBrand.success,
    inputBg,
    inputBorder,
    hoverBg,
    mainText: adminBrand.ink,
    navbarIcon: adminBrand.inkSoft,
    searchIcon: adminBrand.primary,
    placeholder,
  }

  return (
    <Flex pe={{ sm: '0px', md: '4px' }} w={{ sm: 'auto', md: 'auto' }} align="center" gap="1.5">
      <InputGroup
        display={{ base: 'none', '2xl': 'flex' }}
        bg={styles.inputBg}
        borderRadius="12px"
        w="220px"
        me={{ sm: 'auto', md: '6px' }}
        borderWidth="1px"
        borderColor={styles.inputBorder}
        transition="all 0.2s ease"
        _focusWithin={{
          borderColor: styles.accent,
          boxShadow: '0 0 0 3px rgba(93,35,148,0.12)',
        }}
      >
        <InputLeftElement pointerEvents="none" pl="14px">
          <SearchIcon color={styles.searchIcon} w="14px" h="14px" />
        </InputLeftElement>
        <Input
          fontSize="13px"
          py="8px"
          pl="42px"
          pr="14px"
          color={styles.mainText}
          placeholder="Search shipments, sellers, AWB"
          borderRadius="inherit"
          _placeholder={{ color: styles.placeholder }}
          border="none"
          _focus={{ border: 'none' }}
          fontWeight="500"
        />
      </InputGroup>

      {isLoggedIn ? (
        <Popover placement="bottom-end" closeOnBlur>
          {({ onClose }) => (
            <>
              <PopoverTrigger>
                <Button
                  px="12px"
                  minH="36px"
                  me={{ sm: '2px', md: '6px' }}
                  color={styles.accentSecondary}
                  variant="ghost"
                  leftIcon={<IconLogout size={16} color={styles.accentSecondary} />}
                  borderRadius="10px"
                  borderWidth="1px"
                  borderColor="transparent"
                  fontWeight="600"
                  fontSize="sm"
                  _hover={{
                    bg: styles.hoverBg,
                    color: styles.accentSecondary,
                    borderColor: 'rgba(122,61,180,0.18)',
                  }}
                >
                  <Text display={{ base: 'none', '2xl': 'flex' }}>Logout</Text>
                </Button>
              </PopoverTrigger>
              <PopoverContent
                w="300px"
                p="0"
                borderRadius="14px"
                boxShadow="0 20px 36px rgba(15, 46, 102, 0.2)"
                borderWidth="1px"
                borderColor={styles.inputBorder}
                overflow="hidden"
                bg={styles.inputBg}
              >
                <PopoverArrow />
                <PopoverBody p="16px">
                  <Box mb="14px">
                    <Text fontSize="md" fontWeight="700" color={styles.mainText} mb="2px">
                      Confirm Logout
                    </Text>
                    <Text fontSize="sm" color={styles.searchIcon}>
                      You will leave the Shipzilla admin workspace.
                    </Text>
                  </Box>
                  <Flex justify="flex-end" gap="8px">
                    <Button size="sm" variant="ghost" onClick={onClose} borderRadius="10px" _hover={{ bg: styles.hoverBg }}>
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      bg="red.500"
                      color="white"
                      borderRadius="10px"
                      fontWeight="600"
                      _hover={{ bg: 'red.600' }}
                      onClick={() => {
                        logout()
                        onClose()
                      }}
                    >
                      Logout
                    </Button>
                  </Flex>
                </PopoverBody>
              </PopoverContent>
            </>
          )}
        </Popover>
      ) : null}

      <SidebarResponsive logoText={rest.logoText || adminBrand.panelName} secondary={secondary} routes={routes} {...rest} />

      <IconButton
        aria-label="Settings"
        icon={<SettingsIcon w="18px" h="18px" color={styles.accentSky} />}
        variant="ghost"
        ms={{ base: '6px', xl: '0px' }}
        me="2px"
        ref={settingsRef}
        onClick={onOpen}
        color={styles.navbarIcon}
        borderRadius="10px"
        w="34px"
        h="34px"
        borderWidth="1px"
        borderColor="transparent"
        _hover={{
          bg: styles.hoverBg,
          color: styles.accentSky,
          borderColor: 'rgba(86,232,19,0.18)',
        }}
      />

      <NotificationMenu themeStyles={styles} />
    </Flex>
  )
}

HeaderLinks.propTypes = {
  variant: PropTypes.string,
  fixed: PropTypes.bool,
  secondary: PropTypes.bool,
  onOpen: PropTypes.func,
  logoText: PropTypes.string,
}

