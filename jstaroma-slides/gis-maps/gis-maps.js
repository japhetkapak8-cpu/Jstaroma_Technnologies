document.addEventListener(
  "DOMContentLoaded",
  () => {

    const menuButton =
      document.getElementById(
        "mobile-menu-button"
      );

    const mobileNav =
      document.getElementById(
        "mobile-nav"
      );


    if (
      menuButton &&
      mobileNav
    ) {

      menuButton.addEventListener(
        "click",
        () => {

          const isOpen =
            mobileNav.classList.toggle(
              "open"
            );


          menuButton.setAttribute(
            "aria-expanded",
            String(isOpen)
          );

        }
      );


      const links =
        mobileNav.querySelectorAll(
          "a"
        );


      links.forEach((link) => {

        link.addEventListener(
          "click",
          () => {

            mobileNav.classList.remove(
              "open"
            );


            menuButton.setAttribute(
              "aria-expanded",
              "false"
            );

          }
        );

      });

    }

  }
);