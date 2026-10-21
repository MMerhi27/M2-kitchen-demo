// Menu elements
const menuGrid = document.querySelector(".menu-grid");
const searchInput = document.querySelector(".search-box input");
const categoryButtons = document.querySelectorAll(".categories button");
const resultsCount = document.querySelector("#results-count");

// Dish dialog elements
const dishDialog = document.querySelector("#dish-dialog");
const dialogImage = document.querySelector("#dialog-image");
const dialogTitle = document.querySelector("#dialog-title");
const dialogDescription = document.querySelector("#dialog-description");
const dialogPrice = document.querySelector("#dialog-price");
const dialogClose = document.querySelector(".dialog-close");
const dialogAdd = document.querySelector("#dialog-add");
const cartFeedback = document.querySelector("#cart-feedback");

// Cart elements
const cartToggle = document.querySelector("#cart-toggle");
const cartDialog = document.querySelector("#cart-dialog");
const cartClose = document.querySelector("#cart-close");
const cartItemsContainer = document.querySelector("#cart-items");
const cartCount = document.querySelector("#cart-count");
const cartTotal = document.querySelector("#cart-total");

// Order details elements
const customerName = document.querySelector("#customer-name");
const orderType = document.querySelector("#order-type");
const deliveryFields = document.querySelector("#delivery-fields");
const customerAddress = document.querySelector("#customer-address");
const orderNotes = document.querySelector("#order-notes");
const sendOrderButton = document.querySelector("#send-order");
const orderFeedback = document.querySelector("#order-feedback");

// Restaurant WhatsApp number
const restaurantPhone = "96172316213";

// Cart storage settings
const CART_STORAGE_KEY = "m2-kitchen-cart";
const CART_EXPIRY_MS = 24 * 60 * 60 * 1000;
const MAX_QUANTITY = 99;

// Create an availability label inside the dish dialog
const dialogStatus = document.createElement("p");
dialogStatus.className = "dish-status";
dialogStatus.hidden = true;
dialogPrice.after(dialogStatus);

dishDialog.setAttribute("aria-labelledby", "dialog-title");

let menuItems = [];
let menuLoaded = false;
let selectedCategory = "all";
let selectedDishId = null;
let lastOpenedCard = null;
let cartExpiresAt = 0;

// Store dish IDs and quantities
const cart = new Map();

// Format prices consistently
const priceFormatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2
});

// Remove saved cart data
function removeSavedCart() {
    try {
        localStorage.removeItem(CART_STORAGE_KEY);
    } catch (error) {
        console.warn("Could not remove the saved cart.", error);
    }
}

// Save only IDs and quantities, without personal details
function saveCart() {
    if (cart.size === 0) {
        cartExpiresAt = 0;
        removeSavedCart();
        return;
    }

    const savedCart = {
        expiresAt: cartExpiresAt,
        items: Array.from(cart, ([id, quantity]) => ({
            id,
            quantity
        }))
    };

    try {
        localStorage.setItem(
            CART_STORAGE_KEY,
            JSON.stringify(savedCart)
        );
    } catch (error) {
        // The order can still work without browser storage
        console.warn("Could not save the cart.", error);
    }
}

// Extend storage time only when the customer changes the cart
function saveCartChange() {
    cartExpiresAt = cart.size > 0
        ? Date.now() + CART_EXPIRY_MS
        : 0;

    saveCart();
}

// Restore the cart after loading current menu data
function restoreCart() {
    cart.clear();
    cartExpiresAt = 0;

    try {
        const rawCart = localStorage.getItem(CART_STORAGE_KEY);

        if (!rawCart) {
            return;
        }

        const savedCart = JSON.parse(rawCart);

        if (
            !savedCart ||
            !Number.isFinite(savedCart.expiresAt) ||
            savedCart.expiresAt <= Date.now() ||
            !Array.isArray(savedCart.items)
        ) {
            removeSavedCart();
            return;
        }

        cartExpiresAt = savedCart.expiresAt;

        savedCart.items.forEach((savedItem) => {
            if (
                !savedItem ||
                !Number.isInteger(savedItem.id) ||
                !Number.isInteger(savedItem.quantity) ||
                savedItem.quantity < 1 ||
                savedItem.quantity > MAX_QUANTITY
            ) {
                return;
            }

            const currentItem = menuItems.find(
                (item) => item.id === savedItem.id
            );

            // Restore only dishes that still exist and are available
            if (!currentItem || currentItem.available === false) {
                return;
            }

            cart.set(currentItem.id, savedItem.quantity);
        });

        // Save cleaned data without extending its expiry
        saveCart();
    } catch (error) {
        cart.clear();
        cartExpiresAt = 0;
        removeSavedCart();

        console.warn("Could not restore the cart.", error);
    }
}

// Clear expired orders, including when the page stays open
function clearExpiredCart() {
    if (
        cart.size > 0 &&
        cartExpiresAt > 0 &&
        Date.now() >= cartExpiresAt
    ) {
        cart.clear();
        cartExpiresAt = 0;
        removeSavedCart();
        renderCart();
        return true;
    }

    return false;
}

// Match category buttons to JSON categories
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

        if (menuLoaded) {
            filterMenu();
        }
    });
});

// Prevent background scrolling while a dialog is open
function updateScrollLock() {
    document.body.style.overflow =
        dishDialog.open || cartDialog.open ? "hidden" : "";
}

// Open selected dish details
function openDishDialog(item, card) {
    lastOpenedCard = card;
    selectedDishId = item.id;

    dialogImage.src = item.image;
    dialogImage.alt = item.name;
    dialogTitle.textContent = item.name;
    dialogDescription.textContent = item.description;
    dialogPrice.textContent = priceFormatter.format(item.price);

    const isSoldOut = item.available === false;

    dialogStatus.textContent = isSoldOut ? "Sold out" : "";
    dialogStatus.hidden = !isSoldOut;
    dialogAdd.disabled = isSoldOut;
    cartFeedback.textContent = "";

    if (!dishDialog.open) {
        dishDialog.showModal();
    }

    updateScrollLock();
}

// Close dish details
dialogClose.addEventListener("click", () => {
    dishDialog.close();
});

// Restore focus after closing dish details
dishDialog.addEventListener("close", () => {
    updateScrollLock();

    if (lastOpenedCard && lastOpenedCard.isConnected) {
        lastOpenedCard.focus({ preventScroll: true });
    }
});

// Open the order dialog
cartToggle.addEventListener("click", () => {
    clearExpiredCart();
    renderCart();
    orderFeedback.textContent = "";

    if (!cartDialog.open) {
        cartDialog.showModal();
    }

    updateScrollLock();
});

// Close the order dialog
cartClose.addEventListener("click", () => {
    cartDialog.close();
});

cartDialog.addEventListener("close", () => {
    updateScrollLock();
    cartToggle.focus({ preventScroll: true });
});

// Add the selected dish to the order
dialogAdd.addEventListener("click", () => {
    clearExpiredCart();

    const item = menuItems.find(
        (dish) => dish.id === selectedDishId
    );

    if (!item || item.available === false) {
        return;
    }

    const quantity = cart.get(item.id) || 0;

    if (quantity >= MAX_QUANTITY) {
        cartFeedback.textContent =
            `You can add up to ${MAX_QUANTITY} of this dish.`;
        return;
    }

    cart.set(item.id, quantity + 1);

    saveCartChange();
    renderCart();

    cartFeedback.textContent =
        `${item.name} added to your order.`;
});

// Create a cart control
function createCartButton(text, label, action) {
    const button = document.createElement("button");

    button.type = "button";
    button.textContent = text;
    button.setAttribute("aria-label", label);
    button.addEventListener("click", action);

    return button;
}

// Change a dish quantity
function changeCartQuantity(id, change, action) {
    if (clearExpiredCart()) {
        orderFeedback.textContent =
            "Your saved order expired. Please add your dishes again.";
        cartClose.focus({ preventScroll: true });
        return;
    }

    const item = menuItems.find((dish) => dish.id === id);

    if (
        !item ||
        !cart.has(id) ||
        (change > 0 && item.available === false)
    ) {
        return;
    }

    const quantity = cart.get(id) + change;

    if (quantity > MAX_QUANTITY) {
        return;
    }

    if (quantity <= 0) {
        cart.delete(id);
    } else {
        cart.set(id, quantity);
    }

    saveCartChange();
    renderCart();

    // Restore focus after rebuilding the controls
    const control = cartItemsContainer.querySelector(
        `[data-dish-id="${id}"] [data-action="${action}"]`
    );

    (control || cartClose).focus({ preventScroll: true });
}

// Display selected dishes and totals
function renderCart() {
    cartItemsContainer.replaceChildren();

    let totalQuantity = 0;
    let subtotalCents = 0;

    for (const [id, quantity] of cart) {
        const item = menuItems.find((dish) => dish.id === id);

        if (!item) {
            continue;
        }

        const lineTotalCents =
            Math.round(item.price * 100) * quantity;

        totalQuantity += quantity;
        subtotalCents += lineTotalCents;

        const row = document.createElement("div");
        row.className = "cart-item";
        row.dataset.dishId = String(id);

        const title = document.createElement("h3");
        title.textContent = item.name;

        const lineTotal = document.createElement("p");
        lineTotal.textContent =
            `${quantity} × ${priceFormatter.format(item.price)} = ` +
            priceFormatter.format(lineTotalCents / 100);

        const controls = document.createElement("div");
        controls.className = "cart-item-controls";

        const decrease = createCartButton(
            "−",
            `Decrease quantity of ${item.name}`,
            () => changeCartQuantity(id, -1, "decrease")
        );

        decrease.dataset.action = "decrease";

        const quantityLabel = document.createElement("span");
        quantityLabel.textContent = String(quantity);
        quantityLabel.setAttribute(
            "aria-label",
            `Quantity: ${quantity}`
        );

        const increase = createCartButton(
            "+",
            `Increase quantity of ${item.name}`,
            () => changeCartQuantity(id, 1, "increase")
        );

        increase.dataset.action = "increase";
        increase.disabled =
            item.available === false || quantity >= MAX_QUANTITY;

        const remove = createCartButton(
            "Remove",
            `Remove ${item.name} from order`,
            () => {
                clearExpiredCart();
                cart.delete(id);
                saveCartChange();
                renderCart();
                cartClose.focus({ preventScroll: true });
            }
        );

        remove.className = "remove-item";

        controls.append(
            decrease,
            quantityLabel,
            increase,
            remove
        );

        row.append(title, lineTotal, controls);
        cartItemsContainer.append(row);
    }

    if (totalQuantity === 0) {
        const message = document.createElement("p");
        message.textContent = "Your order is empty.";
        cartItemsContainer.append(message);
    }

    cartCount.textContent = String(totalQuantity);
    cartTotal.textContent =
        priceFormatter.format(subtotalCents / 100);

    cartToggle.setAttribute(
        "aria-label",
        `View order, ${totalQuantity} items, subtotal ${
            priceFormatter.format(subtotalCents / 100)
        }`
    );
}

// Create menu cards
function renderMenu(items) {
    menuGrid.replaceChildren();

    const label = items.length === 1 ? "dish" : "dishes";
    resultsCount.textContent = `${items.length} ${label}`;

    if (items.length === 0) {
        showMessage("No dishes found.");
        return;
    }

    const fragment = document.createDocumentFragment();

    items.forEach((item, index) => {
        const isSoldOut = item.available === false;

        const card = document.createElement("article");
        card.className = "menu-card";
        card.tabIndex = 0;

        card.setAttribute("role", "button");
        card.setAttribute("aria-haspopup", "dialog");
        card.setAttribute("aria-controls", "dish-dialog");
        card.setAttribute(
            "aria-label",
            `View details for ${item.name}${
                isSoldOut ? ", sold out" : ""
            }`
        );

        card.addEventListener("click", () => {
            openDishDialog(item, card);
        });

        card.addEventListener("keydown", (event) => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                openDishDialog(item, card);
            }
        });

        const image = document.createElement("img");

        // Load the first six images immediately
        image.loading = index < 6 ? "eager" : "lazy";
        image.decoding = "async";
        image.alt = item.name;
        image.src = item.image;

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

// Apply category and search filters together
function filterMenu() {
    const searchText =
        searchInput.value.trim().toLowerCase();

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

// Display menu status messages
function showMessage(text) {
    const message = document.createElement("p");
    message.textContent = text;
    message.style.gridColumn = "1 / -1";

    menuGrid.replaceChildren(message);
}

// Load current menu data before restoring the saved cart
async function loadMenu() {
    resultsCount.textContent = "";
    showMessage("Loading menu...");

    try {
        const response = await fetch("data/menu.json", {
            cache: "no-cache"
        });

        if (!response.ok) {
            throw new Error(
                `Failed to load menu: ${response.status}`
            );
        }

        const data = await response.json();

        if (!Array.isArray(data)) {
            throw new Error("Menu data must be an array.");
        }

        const ids = new Set();

        data.forEach((item) => {
            if (
                !item ||
                !Number.isInteger(item.id) ||
                ids.has(item.id) ||
                typeof item.name !== "string" ||
                typeof item.description !== "string" ||
                typeof item.image !== "string" ||
                typeof item.category !== "string" ||
                !Number.isFinite(item.price) ||
                item.price < 0
            ) {
                throw new Error("Invalid menu item data.");
            }

            ids.add(item.id);
        });

        menuItems = data;
        menuLoaded = true;

        restoreCart();
        filterMenu();
        renderCart();
    } catch (error) {
        console.error(error);
        resultsCount.textContent = "";
        showMessage(
            "Could not load the menu. Please try again."
        );
    }
}

// Show address fields only for delivery
function updateDeliveryFields() {
    const isDelivery = orderType.value === "delivery";

    deliveryFields.hidden = !isDelivery;
    customerAddress.required = isDelivery;
    customerAddress.disabled = !isDelivery;
    customerAddress.setCustomValidity("");
}

// Prepare the order message for WhatsApp
sendOrderButton.addEventListener("click", () => {
    orderFeedback.textContent = "";

    if (clearExpiredCart()) {
        orderFeedback.textContent =
            "Your saved order expired. Please add your dishes again.";
        return;
    }

    if (cart.size === 0) {
        orderFeedback.textContent =
            "Please add a dish to your order first.";
        return;
    }

    customerName.setCustomValidity(
        customerName.value.trim()
            ? ""
            : "Please enter your name."
    );

    if (!customerName.reportValidity()) {
        return;
    }

    const isDelivery = orderType.value === "delivery";

    customerAddress.setCustomValidity(
        isDelivery && !customerAddress.value.trim()
            ? "Please enter your delivery address."
            : ""
    );

    if (isDelivery && !customerAddress.reportValidity()) {
        return;
    }

    const itemLines = [];
    let subtotalCents = 0;

    // Use current menu prices and check availability
    for (const [id, quantity] of cart) {
        const item = menuItems.find(
            (dish) => dish.id === id
        );

        if (!item || item.available === false) {
            orderFeedback.textContent =
                "An item is unavailable. Please review your order.";
            return;
        }

        const lineTotalCents =
            Math.round(item.price * 100) * quantity;

        subtotalCents += lineTotalCents;

        itemLines.push(
            `• ${quantity} × ${item.name} — ${
                priceFormatter.format(lineTotalCents / 100)
            }`
        );
    }

    const subtotal =
        priceFormatter.format(subtotalCents / 100);

    const name = customerName.value.trim();
    const address = customerAddress.value.trim();
    const notes = orderNotes.value.trim();

    // Arabic version
    const arabicLines = [
        "طلب M2 Kitchen",
        "",
        "مرحبًا، أودّ تقديم الطلب التالي:",
        "",
        ...itemLines,
        "",
        `المجموع الفرعي: ${subtotal}`,
        `الاسم: ${name}`,
        `نوع الطلب: ${
            isDelivery ? "توصيل" : "استلام من المطعم"
        }`
    ];

    if (isDelivery) {
        arabicLines.push(
            `العنوان: ${address}`,
            "كلفة التوصيل: تُحدَّد عند التأكيد"
        );
    }

    if (notes) {
        arabicLines.push(`ملاحظات: ${notes}`);
    }

    arabicLines.push(
        "",
        `يرجى تأكيد توفّر الأصناف والمبلغ النهائي ووقت ${
            isDelivery ? "التوصيل" : "الاستلام"
        } المتوقع.`,
        "شكرًا لكم.",
        "",
        "حالة الطلب: بانتظار تأكيد المطعم."
    );

    // English version of the same order
    const englishLines = [
        "M2 Kitchen Order",
        "",
        "Hello, I would like to place the following order:",
        "",
        ...itemLines,
        "",
        `Subtotal: ${subtotal}`,
        `Name: ${name}`,
        `Order type: ${isDelivery ? "Delivery" : "Pickup"}`
    ];

    if (isDelivery) {
        englishLines.push(
            `Address: ${address}`,
            "Delivery fee: To be confirmed"
        );
    }

    if (notes) {
        englishLines.push(`Notes: ${notes}`);
    }

    englishLines.push(
        "",
        `Please confirm availability, the final total, and the estimated ${
            isDelivery ? "delivery" : "pickup"
        } time.`,
        "Thank you.",
        "",
        "Order status: Awaiting restaurant confirmation."
    );

    const message = [
        ...arabicLines,
        "",
        "────────────────",
        "English copy of the same order",
        "────────────────",
        "",
        ...englishLines
    ].join("\n");

    const whatsappUrl =
        `https://wa.me/${restaurantPhone}?text=${
            encodeURIComponent(message)
        }`;

    // Keep the cart because opening WhatsApp does not confirm sending
    window.location.assign(whatsappUrl);
});

// Clear custom validation when inputs change
customerName.addEventListener("input", () => {
    customerName.setCustomValidity("");
});

customerAddress.addEventListener("input", () => {
    customerAddress.setCustomValidity("");
});

orderType.addEventListener(
    "change",
    updateDeliveryFields
);

searchInput.addEventListener("input", () => {
    if (menuLoaded) {
        filterMenu();
    }
});

// Check expiry when returning to the page
document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
        clearExpiredCart();
    }
});

window.addEventListener("pageshow", () => {
    clearExpiredCart();
});

// Check expiry while the page remains open
setInterval(clearExpiredCart, 60 * 1000);

// Order button accessibility
cartToggle.setAttribute("aria-haspopup", "dialog");
cartToggle.setAttribute("aria-controls", "cart-dialog");

// Initialize the page
updateDeliveryFields();
renderCart();
loadMenu();