const warehouse = document.getElementById("warehouse");
const search = document.getElementById("search");
const stockOnly = document.getElementById("stockOnly");
const searchBtn = document.getElementById("searchBtn");

const tbody = document.querySelector("#inventoryTable tbody");

const loading = document.getElementById("loading");
const message = document.getElementById("message");

let inventory = [];

let currentSortColumn = "productName";
let currentSortAscending = true;


/****************************************************
 LOAD WAREHOUSES
****************************************************/

async function loadWarehouses() {

    try {

        const response = await fetch("/warehouses");
        const data = await response.json();

        warehouse.innerHTML = "";

        const defaultOption = document.createElement("option");
        defaultOption.value = "";
        defaultOption.textContent = "Select Warehouse";
        warehouse.appendChild(defaultOption);

        let retailFound = false;

        data.forEach(item => {

            const option = document.createElement("option");

            option.value = item.warehouseID;
            option.textContent = item.name;

            warehouse.appendChild(option);

            if (item.name.toLowerCase().includes("retail")) {

                warehouse.value = item.warehouseID;
                retailFound = true;

            }

        });

        updateButton();

        search.focus();

    }

    catch (err) {

        message.textContent = "Unable to load warehouses.";

    }

}


/****************************************************
 ENABLE SEARCH BUTTON
****************************************************/

function updateButton() {

    searchBtn.disabled = !(
        warehouse.value &&
        search.value.trim().length >= 2
    );

}

warehouse.addEventListener("change", updateButton);

search.addEventListener("input", updateButton);


/****************************************************
 SEARCH
****************************************************/

async function searchInventory() {

    message.textContent = "";

    tbody.innerHTML = "";

    loading.classList.remove("hidden");

    searchBtn.disabled = true;

    try {

        const url =

            `/inventory?warehouseID=${warehouse.value}` +

            `&search=${encodeURIComponent(search.value.trim())}` +

            `&inStockOnly=${stockOnly.checked}`;

        const response = await fetch(url);

        const data = await response.json();

        loading.classList.add("hidden");

        inventory = data;

        if (inventory.length === 0) {

            message.textContent =
                "No matching products found.";

        }

        renderTable();

    }

    catch (err) {

        loading.classList.add("hidden");

        message.textContent =
            "Unable to retrieve inventory.";

    }

    updateButton();

    search.focus();

    search.select();

}

searchBtn.addEventListener(

    "click",

    searchInventory

);


/****************************************************
 ENTER KEY SEARCH
****************************************************/

search.addEventListener("keydown", function (e) {

    if (e.key === "Enter") {

        e.preventDefault();

        if (!searchBtn.disabled) {
            searchInventory();
        }

    }

});


/****************************************************
 SORTING
****************************************************/

document.querySelectorAll("th").forEach(header=>{

    header.addEventListener("click",()=>{

        const column=header.dataset.column;

        if(column===currentSortColumn){

            currentSortAscending=!currentSortAscending;

        }

        else{

            currentSortColumn=column;

            currentSortAscending=true;

        }

        renderTable();

    });

});


/****************************************************
 TABLE
****************************************************/

function renderTable(){

    tbody.innerHTML="";

    inventory.sort((a,b)=>{

        let valueA=a[currentSortColumn];

        let valueB=b[currentSortColumn];

        if(currentSortColumn==="stock"){

            valueA=Number(valueA);

            valueB=Number(valueB);

            return currentSortAscending ?

                valueA-valueB :

                valueB-valueA;

        }

        const result=

            String(valueA).localeCompare(

                String(valueB),

                undefined,

                {numeric:true}

            );

        return currentSortAscending ?

            result :

            -result;

    });

    inventory.forEach(product=>{

        const tr=document.createElement("tr");

        let stockClass="stock-good";

        if(product.stock==0){

            stockClass="stock-zero";

        }

        else if(product.stock<=5){

            stockClass="stock-low";

        }

        tr.innerHTML=`

        <td>${product.productName}</td>

        <td>${product.productCode}</td>

        <td>${product.size}</td>

        <td class="${stockClass}">
            ${product.stock}
        </td>

        `;

        tbody.appendChild(tr);

    });

}


/****************************************************
 START
****************************************************/

loadWarehouses();