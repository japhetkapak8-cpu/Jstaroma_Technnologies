import { supabase }
from "../../js/supabase.js";


/* =========================================================
   REQUIRE ADMIN
========================================================= */

export async function requireAdmin() {

  try {

    const {
      data: {
        user
      },
      error: userError
    } =
      await supabase.auth.getUser();


    if (
      userError ||
      !user
    ) {

      console.error(
        "No authenticated user:",
        userError
      );


      window.location.replace(
        "index.html"
      );


      return null;

    }


    console.log(
      "Authenticated user:",
      user.email
    );


    /*
      Verify that the current user
      exists in the admins table.
    */

    const {
      data: admin,
      error: adminError
    } =
      await supabase
        .from("admins")
        .select("user_id")
        .eq(
          "user_id",
          user.id
        )
        .maybeSingle();


    if (
      adminError ||
      !admin
    ) {

      console.error(
        "Admin verification failed:",
        adminError ||
        "User is not an administrator."
      );


      try {

        await supabase.auth.signOut();

      }
      catch (error) {

        console.error(
          "Could not sign out:",
          error
        );

      }


      window.location.replace(
        "index.html"
      );


      return null;

    }


    console.log(
      "Admin verified."
    );


    return user;

  }

  catch (error) {

    console.error(
      "Admin authentication error:",
      error
    );


    window.location.replace(
      "index.html"
    );


    return null;

  }

}


/* =========================================================
   LOGOUT
========================================================= */

export async function logoutAdmin() {

  try {

    const {
      error
    } =
      await supabase.auth.signOut();


    if (error) {

      console.error(
        "Logout error:",
        error
      );

    }

  }

  catch (error) {

    console.error(
      "Logout failed:",
      error
    );

  }

  finally {

    window.location.replace(
      "index.html"
    );

  }

}