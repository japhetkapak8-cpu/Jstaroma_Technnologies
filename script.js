// Mobile navigation
const menuToggle = document.getElementById("menuToggle");
const navMenu = document.getElementById("navMenu");

menuToggle.addEventListener("click", () => {
  navMenu.classList.toggle("active");
});


// Close mobile menu when a link is clicked
document.querySelectorAll(".nav a").forEach(link => {
  link.addEventListener("click", () => {
    navMenu.classList.remove("active");
  });
});


// Automatically update footer year
document.getElementById("year").textContent =
  new Date().getFullYear();


// Contact form demo
const contactForm = document.getElementById("contactForm");
const formMessage = document.getElementById("formMessage");

contactForm.addEventListener("submit", function(event) {

  const name = document.getElementById("name").value;

  formMessage.textContent =
    `Thanks ${name}. Your message has been received.`;

  contactForm.reset();
});