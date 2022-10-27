import express from "express";
import { db } from "./database.js";
import cors from "cors";
import auth from "./auth.js"
import { ObjectID } from "bson"

const port = 8080
const app = express()

// Enable support for JSON body content
app.use(express.json())

// Enable the CORS middleware
const corsOptions = {
    origin: true,

}
app.use(cors(corsOptions))

// DEFINE ENDPOINTS HERE //
///////////////////////////

// Insert new weather station
// add_reading
app.post("/add_reading", auth(["station", "admin"]), (req, res) => {
    const {
        "Time": time = (new Date()).toISOString(),
        "Device ID": device_id = undefined,
        "Device Name": device_name = undefined,
        "Latitude": latitude = undefined,
        "Longitude": longitude = undefined,
        "Temperature (C)": temperature = undefined,
        "Atmospheric Pressure (kPa)": atmo_pressure = undefined,
        "Lightning Average Distance (km)": lightning_avg_dist = undefined,
        "Lightning Strike Count": lightning_strike_count = undefined,
        "Maximum Wind Speed (m/s)": max_wind_speed = undefined,
        "Precipitation (mm/h)": precipitation = undefined,
        "Solar Radiation(W/m2)": solar_radiation = undefined,
        "Vapor Radiation": vapor_radiation = undefined,
        "Humidity (%)": humidity = undefined,
        "Wind Direction (deg)": wind_direction = undefined,
        "Wind Speed (m/s)": wind_speed = undefined
    } = req.body

    // Build document to insert
    const reading_document = {};
    reading_document["Time"] = time;
    if (device_id) reading_document["Device ID"] = device_id;
    if (device_name) reading_document["Device Name"] = device_name;
    if (latitude) reading_document["Latitude"] = latitude;
    if (longitude) reading_document["Longitude"] = longitude;
    if (temperature) reading_document["Temperature (C)"] = temperature;
    if (atmo_pressure) reading_document["Atmospheric Pressure (kPa)"] = atmo_pressure;
    if (lightning_avg_dist) reading_document["Lightning Average Diatance (km)"] = lightning_avg_dist;
    if (lightning_strike_count) reading_document["Lightning Strike Count"] = lightning_strike_count;
    if (max_wind_speed) reading_document["Maximum Wind Speed (m/s)"] = max_wind_speed;
    if (precipitation) reading_document["Precipitation (mm/h)"] = precipitation;
    if (solar_radiation) reading_document["Solar Radiation (W/m2)"] = solar_radiation;
    if (vapor_radiation) reading_document["Vapor Radiation"] = vapor_radiation;
    if (humidity) reading_document["Humidity (%)"] = humidity;
    if (wind_direction) reading_document["Wind Direction (deg)"] = wind_direction;
    if (wind_speed) reading_document["Wind Speed (m/s)"] = wind_speed;

    // Run triggers here
    addDeviceTrigger(reading_document);

    const readings = db.collection("readings")
    readings
        .insertOne(reading_document)
        .then((insert_result) => {
            res.status(200).json({
                status: "Reading added",
            })
        })

    .catch((error) => {
        res.status(500).json({
            code: 500,
            message: error,
        })
    })
});

// Request a new authentication key
// request_api_key
app.post("/request_api_key", (req, res) => {
    const default_role = "client";
    const date_now = new Date()

    const access = db.collection("access")
    access.insertOne({
            access_created_date: date_now,
            role: default_role,
        })
        .then((insert_result) => {
            res.status(200).json({
                api_key: insert_result.insertedId.toString(),
                access_created_date: date_now,
                role: default_role,
            });
        }).catch((error) => {
            res.status(500).json({
                code: 500,
                message: "Failed to create API Key"
            });
        });
});

// Convert temperature to fahrenheit
// convert_fahrenheit
app.options("/convert_fahrenheit", cors())
app.patch(
    "/convert_fahrenheit",
    auth(["client", "station", "admin"]),
    (req, res) => {

        // Get the readings collection from db
        const readings = db.collection("readings");

        // Get and validate reading ids
        const reading_ids = req.body.readings_to_convert
            .filter((reading_id) => ObjectID.isValid(reading_id))
            .map((reading_id) => ObjectID(reading_id));

        // updateMany filter: _id is in the list of reading ids
        // operation: set calculate and fahrenheit field
        readings.updateMany({ _id: { $in: reading_ids } }, [{
            $set: {
                "Temperature (F)": {
                    $add: [{ $multiply: ["$Temperature (C)", 1.8] }, 32],
                },
            },
        }, ]).then((query_result) => {
            res.status(200).json({
                status: "Updated celcius",
            });
        }).catch(() => {
            res.status(500).json({
                code: 500,
                message: "Temperature failed to convert",
            });
        });
    });

// Request maximum precipitation by date range
// max_precipitation_by_date_range
app.get(
    "/max_precipitation_by_date_range",
    auth(["client, station", "admin"]),
    (req, res) => {
        res.status(501).json({
            code: 501,
            message: "Not yet implemented"
        });
    });

// Request weather metrics by datetime
// weather_metrics_at_datetime
app.get(
    "/weather_metrics_at_datetime",
    auth(["client", "station", "admin"]),
    (req, res) => {
        // Request weather metrics from body
        // Request datetime from body
        const temperature = req.body.temperature
        const datetime = req.body.time
            // Get access to database
        const readings = db.collection("readings")

        //Find the weather metrics using findMany()
        //Find the datetime, and then find weather metrics with the speciic datetime given
        // Filter weather metrics by datetime
        readings.findOne({
            "Time": { $eq: [req.body.time] }
        }, {
            "Temperature (C)": req.body.temperature

        }).then(() => {
            res.status(200).json({
                temperature,
                datetime
            })
        }).catch(() => {
            res.status(500).json({
                code: 500,
                message: "Failed to retrieve weather metrics",
            });
        });
    });


// Delete one API Key 
// delete_api_key
app.options("/delete_api_key", cors())
app.delete(
    "/delete_api_key",
    auth(["admin"]),
    (req, res) => {
        // Get api_key in the body
        const delete_api_key = req.body.api_key_to_delete
            // Get the access collection fromt the db
        const access = db.collection("access")
            // Run the deleteOne function on the access collectio with a filter sort key
        access.deleteOne({
                "_id": ObjectID(req.body.delete_api_key)
            })
            .then(() => {
                res.status(200).json({
                    status: "API Key deleted",
                })
            }).catch(() => {
                res.status(500).json({
                    code: 500,
                    message: "Failed to delete API Key",

                });
            });

    });

// Delete multiple API keys
// delete_api_keys
app.options("/delete_api_keys", cors())
app.delete(
    "/delete_api_keys",
    auth(["client", "station", "admin"]),
    (req, res) => {
        // Get api keys in body
        // Get api keys to delete
        const delete_api_keys = req.body.api_keys_to_delete
            .filter((delete_api_key) => ObjectID.isValid(delete_api_key))
            .map((delete_api_key) => ObjectID(delete_api_key));

        // Get the access collection fromt the db
        const access = db.collection("access")

        // Run the deleteMany function on the access collection
        access.deleteMany({
                _id: {
                    $in: (delete_api_keys)
                }
            })
            .then(() => {
                res.status(200).json({
                    status: "API Keys deleted",
                })
            }).catch(() => {
                res.status(500).json({
                    code: 500,
                    message: "Failed to delete API Keys",

                });
            });
    });

// Update API keys
// update_api_keys
app.patch(
    "/update_api_keys",
    auth(["client, station", "admin"]),
    (req, res) => {
        res.status(501).json({
            code: 501,
            message: "Not yet implemented"
        });
    });

// Update coordinates of weather station
// update_coordinates
app.patch(
    "/update_coordinates",
    auth(["client, station", "admin"]),
    (req, res) => {
        const update_station_coordinates = req.body.update_station_id
            // Get weather station ID
        const longitude = req.body.longitude_id;
        // Get weather station ID
        const latitude = req.body.latitude_id

        // Get the access collection fromt the db
        const readings = db.collection("readings")

        // Run the deleteOne function on the access collectio with a filter sort key
        readings.updateOne({
                _id: ObjectID(update_station_coordinates)
            }, {
                $set: {
                    "Latitude": (longitude),
                    "Atmospheric Pressure (kPa)": (latitude),

                }

            }, )
            .then((query_result) => {
                res.status(200).json({
                    status: "Coordinates Updated",
                })
            }).catch(() => {
                res.status(500).json({
                    code: 500,
                    message: "Failed to update coordinates",

                });
            });
    });

//
const addDeviceTrigger = (fullDocument) => {
    if (fullDocument["Device ID"] == null && fullDocument["Device Name"]) {
        const generatedDeviceID = fullDocument["Device Name"]
            .split(" ")
            .map(
                (part) =>
                part.substring(0, Math.min(part.length, 2)) +
                part.substring(part.length - 2, part.length)
            )
            .join("_")
            .toLowerCase();

        fullDocument["Device ID"] = generateDeviceID;

    }
}

// Listen for incoming requests
app.listen(port, () => {
    console.log(`Express server started on http://localhost:${port}`);
});