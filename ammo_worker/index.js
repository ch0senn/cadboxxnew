const menu = document.getElementById("menu"),
    chevron = document.getElementById("chevron");

const toggleDropdown = () => {
    menu.classList.toggle("open");
    chevron.querySelector = !menu.classList.contains("open")
        ? ""
        : "";
};

const handleMainButtonClicked = () =>
    alert("Bot�o clicado!");

const handleMenuButtonClicked = () => {
    toggleDropdown();
    alert("Bot�o clicado!");
};
