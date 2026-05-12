import { Button, Drawer, IconButton } from "@mui/material";
import { CloseRounded, MenuRounded, NorthEastRounded } from "@mui/icons-material";
import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import LogoMark from "../brand/LogoMark";
import { navLinks } from "../../data/siteData";

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <header className="site-header">
        <div className="container-shell site-header__inner">
          <Link className="brand-link" to="/">
            <LogoMark compact />
          </Link>

          <nav aria-label="Primary" className="site-nav">
            {navLinks.map((item) => (
              <NavLink
                key={item.to}
                className={({ isActive }) => `site-nav__link ${isActive ? "site-nav__link--active" : ""}`}
                to={item.to}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="site-header__actions">
            <Button
              className="button-ghost"
              component={Link}
              to="/login"
              variant="outlined"
            >
              Demo Login
            </Button>
            <Button
              className="button-primary"
              component={Link}
              endIcon={<NorthEastRounded />}
              to="/rate-calculator"
              variant="contained"
            >
              Start Shipping
            </Button>
            <IconButton
              className="site-header__menu"
              color="primary"
              onClick={() => setMobileOpen(true)}
            >
              <MenuRounded />
            </IconButton>
          </div>
        </div>
      </header>

      <Drawer
        anchor="right"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        PaperProps={{ className: "mobile-drawer" }}
      >
        <div className="mobile-drawer__header">
          <LogoMark compact />
          <IconButton onClick={() => setMobileOpen(false)}>
            <CloseRounded />
          </IconButton>
        </div>
        <div className="mobile-drawer__content">
          {navLinks.map((item) => (
            <NavLink
              key={item.to}
              className={({ isActive }) =>
                `mobile-drawer__link ${isActive ? "mobile-drawer__link--active" : ""}`
              }
              onClick={() => setMobileOpen(false)}
              to={item.to}
            >
              {item.label}
            </NavLink>
          ))}
          <Button
            className="button-primary mobile-drawer__cta"
            component={Link}
            onClick={() => setMobileOpen(false)}
            to="/rate-calculator"
            variant="contained"
          >
            Start Shipping
          </Button>
        </div>
      </Drawer>
    </>
  );
}
