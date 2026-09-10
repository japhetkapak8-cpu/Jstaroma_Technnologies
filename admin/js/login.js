import { supabase }
from "../../js/supabase.js";


const loginForm =
  document.getElementById(
    "loginForm"
  );


const emailInput =
  document.getElementById(
    "email"
  );


const passwordInput =
  document.getElementById(
    "password"
  );


const loginBtn =
  document.getElementById(
    "loginBtn"
  );


const loginMessage =
  document.getElementById(
    "loginMessage"
  );


// ========================================
// CHECK ADMIN
// ========================================

async function checkAdmin(
  userId
) {

  try {

    const {
      data,
      error
    } =
      await supabase
        .from("admins")
        .select("user_id")
        .eq(
          "user_id",
          userId
        )
        .maybeSingle();


    if (error) {

      console.error(
        "Admin check failed:",
        error
      );

      return false;
    }


    return Boolean(
      data
    );

  }

  catch (
    error
  ) {

    console.error(
      "Admin check error:",
      error
    );


    return false;

  }

}


// ========================================
// CHECK EXISTING SESSION
// ========================================

async function checkSession() {

  try {

    const {
      data: {
        user
      },
      error
    } =
      await supabase.auth
        .getUser();


    if (
      error ||
      !user
    ) {

      return;
    }


    const isAdmin =
      await checkAdmin(
        user.id
      );


    if (isAdmin) {

      window.location.replace(
        "dashboard.html"
      );

      return;
    }


    await supabase.auth
      .signOut();

  }

  catch (
    error
  ) {

    console.error(
      "Session check error:",
      error
    );

  }

}


// ========================================
// LOGIN
// ========================================

loginForm
  ?.addEventListener(
    "submit",
    async event => {

      event.preventDefault();


      loginMessage.textContent =
        "";


      loginBtn.disabled =
        true;


      loginBtn.innerHTML =
        `
          <i class="fa-solid fa-spinner fa-spin"></i>
          Signing in...
        `;


      try {

        const {
          data,
          error
        } =
          await supabase.auth
            .signInWithPassword({

              email:
                emailInput.value
                  .trim(),

              password:
                passwordInput.value

            });


        if (
          error ||
          !data?.user
        ) {

          showError(
            error?.message ||
            "Could not sign in."
          );


          return;
        }


        const isAdmin =
          await checkAdmin(
            data.user.id
          );


        if (
          !isAdmin
        ) {

          await supabase.auth
            .signOut();


          showError(
            "You are not authorized to access the JStaroma admin portal."
          );


          return;
        }


        window.location.replace(
          "dashboard.html"
        );

      }

      catch (
        error
      ) {

        console.error(
          "Login error:",
          error
        );


        showError(
          "Could not sign in. Please try again."
        );

      }

      finally {

        resetButton();

      }

    }
  );


// ========================================
// SHOW ERROR
// ========================================

function showError(
  message
) {

  loginMessage.textContent =
    message;


  loginMessage.className =
    "form-message error";

}


// ========================================
// RESET BUTTON
// ========================================

function resetButton() {

  loginBtn.disabled =
    false;


  loginBtn.innerHTML =
    `
      <i class="fa-solid fa-right-to-bracket"></i>
      Sign In
    `;

}


// ========================================
// INITIALIZE
// ========================================

checkSession();