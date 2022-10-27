// Define an API key based authentication middleware
//

import { ObjectID } from "bson"
import { db } from "./database.js"

// This function is a highe-order function
export default function auth(allowed_roles) {
    return function(req, res, next) {
        const api_key = req.body.api_key

        if (ObjectID.isValid(api_key)) {
            const access = db.collection("access")
            access.findOne({ _id: new ObjectID(api_key) })
                .then((access_document) => {
                    if (allowed_roles.includes(access_document.role)) {
                        next();
                    } else {
                        res.status(403).json({
                            code: 403,
                            message: "forbidden - API Key insufficient role",
                        });
                    }
                })
                .catch((error) => {
                    res.status(404).json({
                        code: 404,
                        message: "Not found - API Key not found"
                    })
                })
        } else {
            res.status(401).json({
                code: 401,
                message: "Unauthorised - API Key missing or invalid",
            })
        }
    }
}