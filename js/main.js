const menuGrid = document.querySelector(".menu-grid");
const searchInput = document.querySelector(".search-box input");
const categoryButtons = document.querySelectorAll(".categories button");
const resultsCount = document.querySelector("#results-count");

const dishDialog = document.querySelector("#dish-dialog");
const dialogImage = document.querySelector("#dialog-image");
const dialogTitle = document.querySelector("#dialog-title");
const dialogDescription = document.querySelector("#dialog-description");
const dialogPrice = document.querySelector("#dialog-price");
const dialogClose = document.querySelector(".dialog-close");

// Create an availability label inside the dialog
const dialogStatus = document.createElement("p");
dialogStatus.className = "dish-status";
dialogStatus.hidden = true;
dialogPrice.after(dialogStatus);

let menuItems = [];
let selectedCategory = "all";
let lastOpenedCard = null;

// Format all prices consistently
const priceFormatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2
});

// Match buttons to JSON categories using their HTML order
const categories = ["all", "burgers", "pizza", "drinks"];

categoryButtons.forEach((button, index) => {
    button.dataset.category = categories[index];

    button.setAttribute(
        "aria-pressed",
        String(categories[index] === selectedCategory)
    );

    button.addEventListener("click", () => {
        selectedCategory = button.dataset.category;

        categoryButtons.forEach((item) => {
            const isSelected = item === button;

            item.classList.toggle("active", isSelected);
            item.setAttribute("aria-pressed", String(isSelected));
        });

        filterMenu();
    });
});

// Fill the dialog with the selected dish and open it
function openDishDialog(item, card) {
    lastOpenedCard = card;

    dialogImage.src = item.image;
    dialogImage.alt = item.name;
    dialogTitle.textContent = item.name;
    dialogDescription.textContent = item.description;
    dialogPrice.textContent = priceFormatter.format(item.price);

    // Reset availability whenever a different dish is opened
    const isSoldOut = item.available === false;
    dialogStatus.textContent = isSoldOut ? "Sold out" : "";
    dialogStatus.hidden = !isSoldOut;

    dishDialog.showModal();
    document.body.style.overflow = "hidden";
}

// Close the dialog using the close button
dialogClose.addEventListener("click", () => {
    dishDialog.close();
});

// Restore scrolling and focus after closing, including with Escape
dishDialog.addEventListener("close", () => {
    document.body.style.overflow = "";

    if (lastOpenedCard && lastOpenedCard.isConnected) {
        lastOpenedCard.focus({ preventScroll: true });
    }
});

// Create and display dish cards
function renderMenu(items) {
    menuGrid.replaceChildren();

    // Update the number of matching dishes
    const label = items.length === 1 ? "dish" : "dishes";
    resultsCount.textContent = `${items.length} ${label}`;

    if (items.length === 0) {
        showMessage("No dishes found.");
        return;
    }

    const fragment = document.createDocumentFragment();

    items.forEach((item) => {
        const isSoldOut = item.available === false;

        const card = document.createElement("article");
        card.className = "menu-card";

        // Make the card accessible with a mouse and keyboard
        card.tabIndex = 0;
        card.setAttribute("role", "button");
        card.setAttribute("aria-haspopup", "dialog");
        card.setAttribute("aria-controls", "dish-dialog");
        card.setAttribute(
            "aria-label",
            `View details for ${item.name}${isSoldOut ? ", sold out" : ""}`
        );

        // Open dish details when the card is clicked
        card.addEventListener("click", () => {
            openDishDialog(item, card);
        });

        // Support Enter and Space keys
        card.addEventListener("keydown", (event) => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                openDishDialog(item, card);
            }
        });

        const image = document.createElement("img");
        image.src = item.image;
        image.alt = item.name;
        image.loading = "lazy";

        const content = document.createElement("div");
        content.className = "card-content";

        const title = document.createElement("h2");
        title.textContent = item.name;

        const description = document.createElement("p");
        description.textContent = item.description;

        const price = document.createElement("span");
        price.className = "price";
        price.textContent = priceFormatter.format(item.price);

        content.append(title, description, price);

        // Show a label only when the dish is explicitly unavailable
        if (isSoldOut) {
            const status = document.createElement("p");
            status.className = "dish-status";
            status.textContent = "Sold out";

            content.append(status);
        }

        card.append(image, content);
        fragment.append(card);
    });

    menuGrid.append(fragment);
}

// Apply the search text and selected category together
function filterMenu() {
    const searchText = searchInput.value.trim().toLowerCase();

    const filteredItems = menuItems.filter((item) => {
        const matchesCategory =
            selectedCategory === "all" ||
            item.category === selectedCategory;

        const matchesSearch =
            item.name.toLowerCase().includes(searchText) ||
            item.description.toLowerCase().includes(searchText);

        return matchesCategory && matchesSearch;
    });

    renderMenu(filteredItems);
}

// Display loading, error, or empty-result messages
function showMessage(text) {
    const message = document.createElement("p");
    message.textContent = text;
    message.style.gridColumn = "1 / -1";

    menuGrid.replaceChildren(message);
}

// Load dish data from the JSON file
async function loadMenu() {
    resultsCount.textContent = "";
    showMessage("Loading menu...");

    try {
        const response = await fetch("data/menu.json");

        if (!response.ok) {
            throw new Error(`Failed to load menu: ${response.status}`);
        }

        const data = await response.json();

        if (!Array.isArray(data)) {
            throw new Error("Menu data must be an array.");
        }

        menuItems = data;
        filterMenu();
    } catch (error) {
        console.error(error);
        resultsCount.textContent = "";
        showMessage("Could not load the menu. Please try again.");
    }
}

// Update results whenever the search text changes
searchInput.addEventListener("input", filterMenu);

// Load the menu when the script runs
loadMenu();