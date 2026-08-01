const express = require("express");
const axios = require("axios");
const cors = require("cors");
const path = require("path");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

const PORT = 3000;

/*************************************************
 * ERPLY SETTINGS
 *************************************************/

const CLIENT_CODE = process.env.CLIENT_CODE;
const USERNAME = process.env.USERNAME;
const PASSWORD = process.env.PASSWORD;
const ERPLY_URL = process.env.ERPLY_URL;


/*************************************************
 * SESSION CACHE
 *************************************************/

let sessionKey = null;
let sessionExpiry = 0;

/*************************************************
 * VERIFY USER
 *************************************************/

async function verifyUser() {

    // Use cached session if still valid

    if (sessionKey && Date.now() < sessionExpiry) {

        return sessionKey;

    }

    try {

        const formData = new URLSearchParams();

        formData.append("clientCode", CLIENT_CODE);
        formData.append("username", USERNAME);
        formData.append("password", PASSWORD);
        formData.append("request", "verifyUser");

        const response = await axios.post(

            ERPLY_URL,

            formData,

            {

                headers: {

                    "Content-Type":
                        "application/x-www-form-urlencoded"

                }

            }

        );

        const data = response.data;

        if (

            !data.status ||

            data.status.responseStatus !== "ok"

        ) {

            throw new Error(

                "ERPLY Login Failed"

            );

        }

        sessionKey = data.records[0].sessionKey;

        // Cache for 55 minutes

        sessionExpiry = Date.now() + (55 * 60 * 1000);

        console.log("ERPLY Login Successful");

        return sessionKey;

    }

    catch (err) {

        console.error(err.response?.data || err.message);

        throw err;

    }

}

/*************************************************
 * GENERIC ERPLY REQUEST
 *************************************************/
//console.log("Searching for:", search);

async function erplyRequest(parameters) {

    let session = await verifyUser();

    parameters.clientCode = CLIENT_CODE;
    parameters.sessionKey = session;

    try {

        const response = await axios.post(

            ERPLY_URL,

            new URLSearchParams(parameters),

            {

                headers: {

                    "Content-Type":
                        "application/x-www-form-urlencoded"

                }

            }

        );

        const data = response.data;

        if (

            data.status &&

            (

                data.status.errorCode == 1054 ||

                data.status.errorCode == 1055

            )

        ) {

            console.log("Session expired.");

            sessionKey = null;
            sessionExpiry = 0;

            session = await verifyUser();

            parameters.sessionKey = session;

            const retry = await axios.post(

                ERPLY_URL,

                new URLSearchParams(parameters),

                {

                    headers: {

                        "Content-Type":
                            "application/x-www-form-urlencoded"

                    }

                }

            );

            return retry.data;

        }

        return data;

    }

    catch (err) {

        console.error(err.response?.data || err.message);

        throw err;

    }

}
//console.log(JSON.stringify(data.status, null, 2));
//console.log("Returned:", data.records.length);

/*************************************************
 * GET WAREHOUSES
 *************************************************/

app.get("/warehouses", async (req, res) => {

    try {

        const data = await erplyRequest({

            request: "getWarehouses"

        });

        res.json(data.records);

    }

    catch (err) {

        res.status(500).json({

            error: "Unable to load warehouses."

        });

    }

});

/*************************************************
 * SEARCH INVENTORY
 *************************************************/

app.get("/inventory", async (req, res) => {

    try {

        const warehouseID = req.query.warehouseID;
        const search = (req.query.search || "").trim().toLowerCase();
        const inStockOnly = req.query.inStockOnly === "true";

        if (!warehouseID) {
            return res.status(400).json({
                error: "Warehouse is required."
            });
        }

        if (search.length < 2) {
            return res.status(400).json({
                error: "Enter at least 2 characters."
            });
        }

        const data = await erplyRequest({

    request: "getProducts",

    warehouseID: warehouseID,

    getStockInfo: 1,

    amountInStock: 1,

    pageNo: 1,

    recordsOnPage: 10000,

    searchName: search

});

const allProducts = data.records || [];

        //console.log(`Loaded ${allProducts.length} products.`);

        const results = [];

        for (const product of allProducts) {

            const productName = product.name || "";
            const productCode = product.code || "";

            

            let size = "";

            if (Array.isArray(product.variationDescription)) {

                const sizeItem = product.variationDescription.find(v =>
                    v.name &&
                    v.name.toLowerCase().includes("size")
                );

                if (sizeItem)
                    size = sizeItem.value;
            }

            let stock = 0;

            if (
                product.warehouses &&
                product.warehouses[warehouseID]
            ) {

                stock = Number(
                    product.warehouses[warehouseID].totalInStock || 0
                );

            }

            if (inStockOnly && stock <= 0)
                continue;

            results.push({

                productName,

                productCode,

                size,

                stock

            });

        }

        results.sort((a, b) => {

            const nameCompare =
                a.productName.localeCompare(b.productName);

            if (nameCompare !== 0)
                return nameCompare;

            const codeCompare =
                a.productCode.localeCompare(b.productCode);

            if (codeCompare !== 0)
                return codeCompare;

            return a.size.localeCompare(
                b.size,
                undefined,
                { numeric: true }
            );

        });

        res.json(results);

    }

    catch (err) {

        console.error(err);

        res.status(500).json({

            error: "Unable to retrieve inventory."

        });

    }

});


/*************************************************
 * START SERVER
 *************************************************/

app.listen(PORT, () => {

    console.log("");
    console.log("==============================");
    console.log("ERPLY Inventory Server Running");
    console.log(`http://localhost:${PORT}`);
    console.log("==============================");
    console.log("");

});
