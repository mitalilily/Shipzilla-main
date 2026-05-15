import {
  Box,
  Button,
  Flex,
  HStack,
  Text,
} from "@chakra-ui/react";
import PropTypes from "prop-types";
import { NavLink } from "react-router-dom";
import { adminBrand } from "theme/brand";
import AdminNavbarLinks from "./AdminNavbarLinks";

const navItems = [
  { label: "Overview", path: "/admin/dashboard" },
  { label: "Orders", path: "/admin/orders" },
  { label: "Shipping", path: "/admin/couriers" },
  { label: "Finance", path: "/admin/billing-invoices" },
  { label: "Support", path: "/admin/support" },
];

export default function AdminNavbar(props) {
  const { fixed, secondary, onOpen, sidebarWidth = 275, brandText, ...rest } = props;

  const mainText = adminBrand.ink;
  const secondaryText = adminBrand.inkSoft;
  const navbarShadow = "0 18px 36px rgba(67,22,109,0.08)";
  const activeBg = "rgba(93,35,148,0.1)";
  const navShellBg = "rgba(247,243,251,0.86)";
  const navShellBorder = "rgba(93,35,148,0.1)";
  const navbarBg = "rgba(255,255,255,0.96)";
  const navbarBorder = "1px solid rgba(93,35,148,0.1)";

  return (
    <Flex
      position={fixed || !secondary ? "fixed" : "absolute"}
      boxShadow={navbarShadow}
      bg={navbarBg}
      border={navbarBorder}
      backdropFilter="blur(14px)"
      transition="all 0.3s ease"
      alignItems="center"
      borderRadius="20px"
      minH="64px"
      left={{ base: "10px", md: "14px", xl: `${sidebarWidth + 24}px` }}
      right="14px"
      px={{ base: "12px", md: "16px" }}
      py="8px"
      top="12px"
    >
      <Flex
        w="100%"
        flexDirection={{ base: "row", "2xl": "row" }}
        alignItems="center"
        justify="space-between"
        gap={{ base: 2, "2xl": 3 }}
      >
        <Flex
          direction="row"
          align="center"
          minW={0}
          w={{ base: "auto", "2xl": "auto" }}
          flex={{ "2xl": "0 1 280px" }}
          gap="12px"
        >
          <Box
            as="img"
            src={adminBrand.logo}
            alt={adminBrand.panelName}
            h="34px"
            w="126px"
            objectFit="contain"
          />
          <Box minW={0} display={{ base: "none", md: "block" }}>
            <Text
              fontSize="10px"
              fontWeight="800"
              letterSpacing="0.14em"
              textTransform="uppercase"
              color={secondaryText}
            >
              {adminBrand.panelName}
            </Text>
            <Text
              fontSize="sm"
              fontWeight="800"
              color={mainText}
              noOfLines={1}
            >
              {brandText || "Admin dashboard"}
            </Text>
          </Box>
        </Flex>

        <HStack
          display={{ base: "none", "2xl": "flex" }}
          spacing={1}
          px="6px"
          py="4px"
          borderRadius="999px"
          border="1px solid"
          borderColor={navShellBorder}
          bg={navShellBg}
        >
          {navItems.map((item) => (
            <NavLink key={item.label} to={item.path}>
              <Button
                variant="ghost"
                borderRadius="999px"
                px="12px"
                minH="34px"
                fontSize="13px"
                fontWeight="700"
                color={mainText}
                _hover={{ bg: activeBg }}
              >
                {item.label}
              </Button>
            </NavLink>
          ))}
        </HStack>

        <HStack
          ms={{ base: 0, "2xl": "auto" }}
          spacing={2}
          align="center"
          justify="flex-end"
          w={{ base: "auto", "2xl": "auto" }}
          flexShrink={0}
        >
          <AdminNavbarLinks
            onOpen={onOpen}
            logoText={props.logoText}
            secondary={secondary}
            fixed={fixed}
            {...rest}
          />
        </HStack>
      </Flex>
    </Flex>
  );
}

AdminNavbar.propTypes = {
  variant: PropTypes.string,
  secondary: PropTypes.bool,
  fixed: PropTypes.bool,
  onOpen: PropTypes.func,
  sidebarWidth: PropTypes.number,
};
