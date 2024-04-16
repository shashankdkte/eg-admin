const express = require("express");
const util = require("util");
const router = express.Router();
const poolPromise = require("../util/connnectionPromise");    // local_
const poolPromise2 = require("../util/connnectionPromise2");  // egpaidco_neo
// const poolPromise3 = require("../util/connectionPromise3");  // egpaidco_merchant_data
const md5 = require("md5");
const uuid = require("uuid");
const SALT = process.env.SALT;
const axios = require("axios");
const crypto = require("crypto");
const smsapi = require("../globalfunction/sms");
const {
    savevirtualaccount
} = require("../globalfunction/savevirtualaccount");
const requireStaffLogin = require("../middleware/requireEmpLogin");
const requireLogin = require("../middleware/requireLogin");
const path = require("path");
const multer = require("multer");
const moment = require("moment-timezone");
const qs = require('qs');
const {getSecretKeyAndTimeStamp,checkDetails}= require("../globalfunction/getSecretKey");
const { hashOtp, VerifyOtp, getAdhaarConsent, getAdhaarOTP,getAdhaarFile } = require("../middleware/hashOtp");
const { handleFileUpload } = require("../globalfunction/handleUpload");
const { sendGetRequest, verifyAadharOtp, getAadharOtp } = require("../globalfunction/ekycOtpRequest");
const { uniqueId } = require("lodash");


// Configure multer storage for file uploads
const storages = multer.diskStorage({
    destination: "./assets/image/employeedosc",
    filename: (req, file, cb) => {
        return cb(
            null,
            `${file.fieldname}_${Date.now()}${path.extname(file.originalname)}`
        );
    }
});

const upload = multer({
    storage: storages,
    fileFilter: (req, file, cb) => {
        const allowedFileTypes = /jpeg|jpg|png|pdf|text/; // Adjust the allowed file types as per your requirements
        const extname = allowedFileTypes.test(
            path.extname(file.originalname).toLowerCase()
        );
        const mimetype = allowedFileTypes.test(file.mimetype);
        if (extname && mimetype) {
            return cb(null, true);
        } else {
            cb("Error: Only jpeg, jpg, png, and pdf files are allowed.");
        }
    },
});

// Configure multer storage for file uploads
const storages2 = multer.diskStorage({
    destination: "./assets/image/userkycdocs",
    filename: (req, file, cb) => {
        return cb(
            null,
            `${file.fieldname}_${Date.now()}${path.extname(file.originalname)}`
        );
    },
});

const upload2 = multer({
    storage: storages2,
    fileFilter: (req, file, cb) => {
        const allowedFileTypes = /jpeg|jpg|png|pdf|text/; // Adjust the allowed file types as per your requirements
        const extname = allowedFileTypes.test(
            path.extname(file.originalname).toLowerCase()
        );
        const mimetype = allowedFileTypes.test(file.mimetype);
        if (extname && mimetype) {
            return cb(null, true);
        } else {
            cb("Error: Only jpeg, jpg, png, and pdf files are allowed.");
        }
    },
});

// Configure multer storage for file uploads
const storages3 = multer.diskStorage({
    destination: "./assets/image/userdocs",
    filename: (req, file, cb) => {
        return cb(
            null,
            `${file.fieldname}_${Date.now()}${path.extname(file.originalname)}`
        );
    },
});

const upload3 = multer({
    storage: storages3,
    fileFilter: (req, file, cb) => {
        const allowedFileTypes = /jpeg|jpg|png|pdf|text/; // Adjust the allowed file types as per your requirements
        const extname = allowedFileTypes.test(
            path.extname(file.originalname).toLowerCase()
        );
        const mimetype = allowedFileTypes.test(file.mimetype);
        if (extname && mimetype) {
            return cb(null, true);
        } else {
            cb("Error: Only jpeg, jpg, png, and pdf files are allowed.");
        }
    },
});


router.get("/get-app-navigation", requireStaffLogin, async (req, res) => {
    try {
        // Use promise-based connection
        const connection = await poolPromise().getConnection();
        const {
            designation
        } = req.staff;

        try {
            const sql =
                "SELECT * FROM app_navigation WHERE parent_id = ? AND designation = ? AND status = 'Enable' ORDER BY orderby";
            const value = [0, designation];

            const [parent_menu] = await connection.query(sql, value);

            const menu = [];
            for (let i = 0; i < parent_menu.length; i++) {
                const parent_id = parent_menu[i].id;
                const sql1 =
                    "SELECT * FROM app_navigation WHERE parent_id = ? AND designation = ? AND status = 'Enable' ORDER BY orderby";
                const value1 = [parent_id, designation];

                const [submenu] = await connection.query(sql1, value1);

                const data = {
                    parent_menu: parent_menu[i],
                    sub_menu: submenu,
                };
                menu.push(data);
            }

            return res
                .status(200)
                .json({
                    status_code: "1",
                    status: "success",
                    menu: menu
                });
        } catch (err) {
            console.error(err);
            return res
                .status(422)
                .json({
                    status_code: "2",
                    status: "fail",
                    error: err.message
                });
        } finally {
            // Release the connection
            if (connection) {
                await connection.release();
            }
        }
    } catch (err) {
        return res
            .status(422)
            .json({
                status_code: "2",
                status: "fail",
                error: err.message
            });
    }
});

router.post("/update-profile-photo", requireStaffLogin, upload.single("profile_photo"),
    async (req, res) => {
        try {
            // Extract Required Information
            const {
                unique_id
            } = req.staff;
            

            // Validate Input
            if (!unique_id || !req.file) {
                return res
                    .status(400)
                    .json({
                        status_code: "2",
                        status: "failed",
                        message: "Invalid input",
                    });
            }
            const filename = req.file.filename;
            console.log(req.file);
            // Validate File Type for profile_photo specifically
            if (req.file.fieldname === "profile_photo") {
                const allowedTypes = ["image/jpeg", "image/jpg", "image/png"];
                if (!allowedTypes.includes(req.file.mimetype)) {
                    return res.status(400).json({
                        status_code: "2",
                        status: "failed",
                        message: "Invalid file format. Only JPEG, JPG, and PNG files are allowed for profile photos.",
                    });
                }
            }

            // Update Database
            const connection = await poolPromise().getConnection();
            try {
                const query =
                    "UPDATE staff_data SET profile_photo = ? WHERE unique_id = ?";
                await connection.query(query, [filename, unique_id]);

                // Return Response
                res.json({
                    status_code: "1",
                    status: "success",
                    message: "Profile photo successfully updated",
                    profile_photo:filename,
                });
            } catch (error) {
                console.error(error);
                res.status(500).json({
                    status_code: "2",
                    status: "failed",
                    message: "Internal server error",
                });
            } finally {
                // Release the connection back to the pool
                await connection.release();
            }
        } catch (error) {
            console.error(error);
            res.status(500).json({
                status_code: "2",
                status: "failed",
                message: "Internal server error",
            });
        }
    }
);

//Attendance start
router.post("/start-work", requireStaffLogin, upload.single("selfie"),
    async (req, res) => {
        try {
            const staffId = req.staff.unique_id;
            const selfieFilename = req.file.filename;
            const {
                deviceId,
                coordinates,
                ip,
                os
            } = req.body;

            // Get current time and date
            const currentDate = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
            const currentTime = new Date().toTimeString().slice(0, 5); // HH:MM

            // Validate File Type for profile_photo specifically
            if (req.file.fieldname === "selfie") {
                const allowedTypes = ["image/jpeg", "image/jpg", "image/png"];
                if (!allowedTypes.includes(req.file.mimetype)) {
                    return res.status(400).json({
                        status_code: "2",
                        status: "failed",
                        message: "Invalid file format. Only JPEG, JPG, and PNG files are allowed for profile photos.",
                    });
                }
            }

            const connection = await poolPromise().getConnection();
            try {
                // Check for existing check-in today
                const [checkInExists] = await connection.query(
                    "SELECT COUNT(*) FROM attendance WHERE unique_id = ? AND date = ? AND type = ?",
                    [staffId, currentDate, "IN"]
                );

                if (checkInExists[0]["COUNT(*)"] > 0) {
                    return res.status(400).json({
                        status_code: "2",
                        status: "failed",
                        message: "Check-in already exists for today.",
                    });
                }

                const query =
                    "INSERT INTO attendance (unique_id, type, date, time, selfie, coordinates, ip, device_Id, os) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";
                const result = await connection.query(query, [
                    staffId,
                    "IN", // this is a "Start Work" entry type
                    currentDate,
                    currentTime,
                    selfieFilename,
                    coordinates,
                    ip,
                    deviceId,
                    os,
                ]);

                res.json({
                    status_code: "1",
                    status: "success",
                    message: "Check In Successfully",
                });
            } catch (error) {
                console.error(error);
                res.status(500).json({
                    status_code: "2",
                    status: "failed",
                    message: "Internal server error",
                });
            } finally {
                // Release the connection back to the pool
                await connection.release();
            }
        } catch (error) {
            console.error(error);
            res.status(400).json({
                status_code: "2",
                status: "failed",
                message: "Invalid request data",
            });
        }
    }
);

router.post("/end-work", requireStaffLogin,
    upload.single("selfie"),
    async (req, res) => {
        try {
            const staffId = req.staff.unique_id;
            const selfieFilename = req.file.filename;
            const {
                deviceId,
                coordinates,
                ip,
                os
            } = req.body;

            const currentDate = new Date().toISOString().slice(0, 10);
            const currentTime = new Date().toTimeString().slice(0, 5);

            // Validate File Type for profile_photo specifically
            if (req.file.fieldname === "selfie") {
                const allowedTypes = ["image/jpeg", "image/jpg", "image/png"];
                if (!allowedTypes.includes(req.file.mimetype)) {
                    return res.status(400).json({
                        status_code: "2",
                        status: "failed",
                        message: "Invalid file format. Only JPEG, JPG, and PNG files are allowed for profile photos.",
                    });
                }
            }

            const connection = await poolPromise().getConnection();
            try {
                // Check for existing check-in today (required for check-out)
                const [checkInExists] = await connection.query(
                    "SELECT COUNT(*) FROM attendance WHERE unique_id = ? AND date = ? AND type = ?",
                    [staffId, currentDate, "IN"]
                );

                if (checkInExists[0]["COUNT(*)"] === 0) {
                    return res.status(400).json({
                        status_code: "2",
                        status: "failed",
                        message: "No check-in found for today.",
                    });
                }

                // Check for existing check-out today (prevent multiple check-outs)
                const [checkOutExists] = await connection.query(
                    "SELECT COUNT(*) FROM attendance WHERE unique_id = ? AND date = ? AND type = ?",
                    [staffId, currentDate, "OUT"]
                );

                if (checkOutExists[0]["COUNT(*)"] > 0) {
                    return res.status(400).json({
                        status_code: "2",
                        status: "failed",
                        message: "Check-out already exists for today.",
                    });
                }

                // Proceed with check-out
                const query =
                    "INSERT INTO attendance (unique_id, type, date, time, selfie, coordinates, ip, device_Id, os) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";
                const result = await connection.query(query, [
                    staffId,
                    "OUT", // this is an "End Work" entry type
                    currentDate,
                    currentTime,
                    selfieFilename,
                    coordinates,
                    ip,
                    deviceId,
                    os,
                ]);

                res.json({
                    status_code: "1",
                    status: "success",
                    message: "Check Out Successfully",
                });
            } catch (error) {
                console.error(error);
                res.status(500).json({
                    status_code: "2",
                    status: "failed",
                    message: "Internal server error",
                });
            } finally {
                // Release the connection back to the pool
                await connection.release();
            }
        } catch (error) {
            console.error(error);
            res.status(400).json({
                status_code: "2",
                status: "failed",
                message: "Invalid request data",
            });
        }
    }
);

// router.get("/today-attendance", requireStaffLogin, async (req, res) => {
//     try {
//         const staffId = req.staff.unique_id;
//         const currentDate = new Date().toISOString().slice(0, 10);

//         const connection = await poolPromise().getConnection();
//         try {
//             const query = "SELECT * FROM attendance WHERE unique_id = ? AND date = ?";
//             const [result] = await connection.query(query, [staffId, currentDate]);

//             if (!result || result.length === 0) {
//                 return res.json({
//                     status_code: "1",
//                     status: "success",
//                     // message: "No attendance found today. Please check-in.",
//                     data: {
//                         "check-in":"false",
//                         "check-out":"false",
//                     }
//                 });
//             }
//             let checkedIn = false;
//             const result_value = result.reduce((acc, entry) => {
//                 acc["check-out"] = false;
//                 acc["check-in"] = false;
//                 if (entry.type === "IN")
//                 {
//                     acc["check-in"] = true;
//                     checkedIn = true;

//                 }
//                 else if (entry.type === "OUT")
//                 {
//                     acc["check-in"] = checkedIn;
//                     acc["check-out"] = true;

//                 }
               
               
//                 return acc;
//             },{})
            
//             return res.json({
//                 status_code: "1",
//                 status: "success",
//                 data: result_value
//             });
//         } catch (error) {
//             console.error(error);
//             res.status(500).json({
//                 status_code: "2",
//                 status: "failed",
//                 message: "Internal server error",
//             });
//         } finally {
//             await connection.release();
//         }
//     } catch (error) {
//         console.error(error);
//         res.status(400).json({
//             status_code: "2",
//             status: "failed",
//             message: "Invalid request data",
//         });
//     }
// });
router.get("/today-attendance", requireStaffLogin, async (req, res) => {
    try {
        const staffId = req.staff.unique_id;
        const currentDate = new Date().toISOString().slice(0, 10);

        const connection = await poolPromise().getConnection();
        try {
            const query = "SELECT * FROM attendance WHERE unique_id = ? AND date = ?";
            const [result] = await connection.query(query, [staffId, currentDate]);

            const data = result.reduce((acc, entry) => {
                if (entry.type === "IN" && !acc["check-in"]) {
                    acc["check-in"] = true;
                } else if (entry.type === "OUT" && !acc["check-out"]) {
                    acc["check-out"] = true;
                }
                return acc;
            }, { "check-in": false, "check-out": false });

            return res.json({
                status_code: "1",
                status: "success",
                data: data
            });
        } catch (error) {
            console.error(error);
            res.status(500).json({
                status_code: "2",
                status: "failed",
                message: "Internal server error",
            });
        } finally {
            await connection.release();
        }
    } catch (error) {
        console.error(error);
        res.status(400).json({
            status_code: "2",
            status: "failed",
            message: "Invalid request data",
        });
    }
});


router.get("/attendance-count", requireStaffLogin, async (req, res) => {
    try {
        const staffId = req.staff.unique_id;
        const currentMonthDate = new Date();
        const currentMonth = currentMonthDate.toISOString().slice(0, 7);
        const firstDayOfMonth = new Date(currentMonth + "-01")
            .toISOString()
            .slice(0, 10);
        const lastDayOfMonth = new Date(
                new Date(currentMonth + "-01").setMonth(
                    currentMonthDate.getMonth() + 1,
                    0
                )
            )
            .toISOString()
            .slice(0, 10);

        const connection = await poolPromise().getConnection();
        try {
            const query = `
        SELECT status, COUNT(*) AS count
        FROM attendance
        WHERE unique_id = ? AND date >= ? AND date < ? AND type = 'IN'
          AND status IN ('Pending', 'Reject', 'Approved')
        GROUP BY status
      `;
            const [result] = await connection.query(query, [
                staffId,
                firstDayOfMonth,
                lastDayOfMonth,
            ]);

            const attendanceCounts = {};
            result.forEach((row) => {
                attendanceCounts[row.status] = row.count;
            });

            res.json({
                status_code: "1",
                status: "success",
                data: attendanceCounts
            });
        } catch (error) {
            console.error(error);
            res.status(500).json({
                status_code: "2",
                status: "failed",
                message: "Internal server error",
            });
        } finally {
            await connection.release();
        }
    } catch (error) {
        console.error(error);
        res.status(400).json({
            status_code: "2",
            status: "failed",
            message: "Invalid request data",
        });
    }
});

//Attendance end

//LEAVE start

router.get("/fetch-leave-records", requireStaffLogin, async (req, res) => {
    try {
        const staffId = req.staff.unique_id;

        const connection = await poolPromise().getConnection();
        try {
            const query = "SELECT * FROM `leave` WHERE unique_id = ?";
            const [results] = await connection.query(query, [staffId]);

            if (results.length === 0) {
                return res.status(404).json({
                    status_code: "2",
                    status: "failed",
                    message: "No Leave record found.",
                });
            }
            console.log(results);

            const formattedResults = results.map((record) => ({
                unique_id: record.unique_id,
                todate: record.todate.toISOString().slice(0, 10),
                fromdate: record.fromdate.toISOString().slice(0, 10),
                reason: record.reason,
                coordinates: record.coordinates,
                status: record.status,
                update_by: record.update_by,
                timestamp: record.timestamp,
                condition: record.condition,
            }));

            return res
                .status(200)
                .json({
                    status_code: "1",
                    status: "success",
                    data: formattedResults
                });
        } catch (error) {
            console.error(error);
            return res.status(500).json({
                status_code: "2",
                status: "failed",
                message: "Internal server error",
            });
        } finally {
            await connection.release();
        }
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            status_code: "2",
            status: "failed",
            message: "Internal server error",
        });
    }
});

router.post("/ask-for-leave", requireStaffLogin, async (req, res) => {
    try {
        const {
            todate,
            fromdate,
            reason,
            coordinates
        } = req.body;
        const {
            unique_id,
            name
        } = req.staff;

        // Validate Input
        const requiredFields = ["todate", "fromdate", "reason", "coordinates"];
        if (!requiredFields.every((field) => field in req.body)) {
            return res.status(400).json({
                status_code: "2",
                status: "failed",
                message: "Missing required fields",
            });
        }

        // Validate Dates
        const todateObj = new Date(todate);
        const fromdateObj = new Date(fromdate);
        if (isNaN(todateObj.getTime()) || isNaN(fromdateObj.getTime())) {
            return res.status(400).json({
                status_code: "2",
                status: "failed",
                message: "Invalid date format",
            });
        }

        // Check Starting Date Validity
        const applyDate = new Date(); // Get current date
        if (fromdateObj <= applyDate) {
            return res.status(400).json({
                status_code: "2",
                status: "failed",
                message: "Leave starting date cannot be in the past",
            });
        }

        // Format date for database storage
        const formattedToDate = todateObj.toISOString().slice(0, 10);
        const formattedFromDate = fromdateObj.toISOString().slice(0, 10);

        const connection = await poolPromise().getConnection();
        try {
            const query =
                "INSERT INTO `leave` (unique_id, todate, fromdate, reason, coordinates, status, update_by) VALUES (?, ?, ?, ?, ?, ?, ?)";
            await connection.query(query, [
                unique_id,
                formattedToDate,
                formattedFromDate,
                reason,
                coordinates,
                "Pending",
                name,
            ]);

            // Return Response
            res.json({
                status_code: "1",
                status: "success",
                message: "Leave request submitted successfully",
            });
        } catch (error) {
            console.error(error);
            res.status(500).json({
                status_code: "2",
                status: "failed",
                message: "Internal server error",
            });
        } finally {
            await connection.release();
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({
            status_code: "2",
            status: "failed",
            message: "Internal server error",
        });
    }
});

//LEAVE end

//Onboard New Distributor start

router.post("/search-distributor", requireStaffLogin, async (req, res) => {
    const connection = await poolPromise().getConnection();
    try {
        const {
            mobile_number,
            aadhar_number
        } = req.body;
        const emp_id = req.staff.emp_id;

        const [distributorData] = await connection.query(
            "SELECT * FROM login WHERE mobile_number = ? ",
            [mobile_number]
        );

        if (distributorData.length > 0) {
            const statusCode = distributorData[0].status;

            switch (statusCode) {
                case "6":
                case "5":
                    const otp = Math.floor(100000 + Math.random() * 900000).toString();
                    const saltedOTP = SALT.concat(otp);
                    const hashedOTP = md5(saltedOTP);

                    await connection.query("UPDATE login SET otp = ? WHERE id = ?", [
                        hashedOTP,
                        distributorData[0].id,
                    ]);

                    if (process.env.aadharVerificaton === "true") {
                        var otpMessage = '';
                        var otpType = '';
                        var access_key = '';

                        const getAddharConsentResult = await getAdhaarConsent(mobile_number);

                        if (getAddharConsentResult.data.access_key !== null) {
                            let accessKey = getAddharConsentResult.data.access_key;
                            const getAddharOtpResult = await getAdhaarOTP(aadhar_number, accessKey, mobile_number);

                            if (getAddharOtpResult.response_status_id === 0) {
                                otpMessage = getAddharOtpResult.data.message;
                                otpType = 'Addhar';
                                access_key = getAddharOtpResult.data.access_key;

                                return res.status(200).json({
                                    status_code: "20",
                                    status: "success",
                                    message: "OTP Successfully Send to Distributor Mobile Number.",
                                    unique_id: distributorData[0].unique_id,
                                    aadhar_number,
                                    otpType,
                                    access_key,

                                });
                            } else {
                                if (getAddharOtpResult.response_status_id === 1) {
                                    await connection.query("UPDATE login SET status = ? WHERE id = ?", [
                                        "6",
                                        distributorData[0].id,
                                    ]);
                                    if (getAddharOtpResult.response_type_id === 1710) {
                                        return res.status(400).json({
                                            status_code: "2",
                                            status: "failed",
                                            message: "Incorrect Adhar number"
                                        });
                                    }
                                    if (getAddharOtpResult.response_type_id === 1620) {
                                        otpMessage = 'Otp send From OurSide';
                                        otpType = 'ourSide';
                                        // smsapi("admin", "otp_send", mobile_number, otp, `3 min`);
                                        smsapi("admin", "onboarding_otp", mobile_number, "Distributor",otp, `3 min`);

                                        await connection.query("UPDATE login SET mobile_number = ? WHERE unique_id = ?", [mobile_number, distributorData[0].unique_id]);
                                        return res.status(200).json({
                                            status_code: "20",
                                            status: "success",
                                            message: otpMessage,
                                            unique_id: distributorData[0].unique_id,
                                            aadhar_number,
                                            otpType,
                                            access_key,

                                        });
                                    }
                                }
                            }
                        }
                    } else {
                        var otpMessage = '';
                        var otpType = '';
                        var access_key = '';

                        if (!otpMessage && !otpType && !access_key) {
                            otpMessage = 'Otp send From OurSide';
                            otpType = 'ourSide';
                            // smsapi("admin", "otp_send", mobile_number, otp, `3 min`);
                            smsapi("admin", "onboarding_otp", mobile_number, "Distributor",otp, `3 min`);

                        }

                        connection.release();
                        return res.status(200).json({
                            status_code: "15",
                            status: "pending",
                            message: otpMessage,
                            unique_id: distributorData[0].unique_id,
                            aadhar_number,
                            otpType,
                            access_key,

                        });
                    }
                    break;

                    // case "5":
                    //     // Distributor Onboard is Pending
                    //     connection.release();
                    //     return res.status(200).json({
                    //         status_code: "16",
                    //         status: "pending",
                    //         application_id: distributorData[0].application_id,
                    //         message: "Distributor Onboard is Pending.",
                    //     });

                case "4":
                    // Distributor KYC is Pending
                    connection.release();
                    return res.status(200).json({
                        status_code: "22",
                        status: "success",
                        message: "Distributor KYC is Pending.",
                        unique_id: distributorData[0].unique_id,
                    });

                case "3":
                    // Distributor Territory assigned is Pending
                    connection.release();
                    return res.status(200).json({
                        status_code: "23",
                        status: "pending",
                        message: "Assign Distributor Territory.",
                        unique_id: distributorData[0].unique_id,
                    });

                case "2":
                case "1":
                    // Distributor Account is Active
                    connection.release();
                    return res.status(200).json({
                        status_code: "2",
                        status: "failed",
                        message: "Distributor Account is Already Registered.",
                    });

                case "0":
                    // Suspended
                    connection.release();
                    return res.status(200).json({
                        status_code: "2",
                        status: "failed",
                        message: "Distributor Account is Suspended.",
                    });

                default:
                    connection.release();
                    return res.status(200).json({
                        status_code: "2",
                        status: "failed",
                        message: "Invalid Account Status.",
                    });
            }
        }
        const [checkAdharDuplicate] = await connection.query("SELECT COUNT(*) as count FROM login WHERE aadhar_number = ?", [aadhar_number])
        if (checkAdharDuplicate[0].count > 0)
        {
            return res.json({
                status_code:"2",
                status: "failed",
                message:"Duplicate aadhar not allowed"
        })
        }
        
        const unique_id = uuid.v4();
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const saltedOTP = SALT.concat(otp);
        const hashedOTP = md5(saltedOTP);

        if (process.env.aadharVerificaton === "true") {
            var otpMessage = ''
            var otpType = ''
            var access_key = ''
            const getAddharConsentResult = await getAdhaarConsent(mobile_number);

            if (getAddharConsentResult?.data?.access_key) {
                let accessKey = getAddharConsentResult.data.access_key;
                const getAddharOtpResult = await getAdhaarOTP(aadhar_number, accessKey, mobile_number);

                if (getAddharOtpResult.response_status_id === 0) {

                    otpMessage = getAddharOtpResult.data.message
                    otpType = 'Addhar',
                        access_key = getAddharOtpResult.data.access_key
                    

                    await connection.query("INSERT INTO login SET ?", {
                        user_type: "Distributor",
                        unique_id,
                        mobile_number: mobile_number,
                        otp: hashedOTP,
                        status: "6",
                        // customer_id: Math.floor(100000 + Math.random() * 900000).toString(),
                        // application_id: Math.floor(100000 + Math.random() * 900000).toString(),
                        aadhar_number,
                        created_date: new Date(),
                        created_by: emp_id,
                        am_id: emp_id,
                    });
                    return res.status(200).json({
                        status_code: "20",
                        status: "success",
                        message: "OTP Successfully Send to Distributor Mobile Number.",
                        unique_id: unique_id,
                        aadhar_number,
                        otpType,
                       
                        access_key

                    });
                } else {
                    if (getAddharOtpResult.response_status_id === 1) {
                        if (getAddharOtpResult.response_type_id === 1710) {
                            return res.status(400).json({
                                status_code: "2",
                                status: "failed",
                                message: "Incorrect Aadhar Number",


                            });
                        }
                        if (getAddharOtpResult.response_type_id === 1620) {
                            otpMessage = 'Otp send From OurSide'
                            otpType = 'ourSide'
                            smsapi("admin", "onboarding_otp", mobile_number, "Distributor",otp, `3 min`);

                            await connection.query("INSERT INTO login SET ?", {
                                user_type: "Distributor",
                                unique_id: unique_id,
                                mobile_number: mobile_number,
                                otp: hashedOTP,
                                status: "6",
                                // customer_id: Math.floor(100000 + Math.random() * 900000).toString(),
                                // application_id: Math.floor(100000 + Math.random() * 900000).toString(),
                                aadhar_number,
                                created_date: new Date(),
                                created_by: emp_id,
                                am_id: emp_id,
                            });

                            return res.status(200).json({
                                status_code: "20",
                                status: "success",
                                message: otpMessage,
                                unique_id,
                                otpType,
                                otpMessage,
                                access_key

                            });
                        }
                    }
                }
            } else {
                var otpMessage = '';
                var otpType = '';
                var access_key = '';
                

                if (!otpMessage && !otpType && !access_key) {
                    otpMessage = 'Otp send From OurSide';
                    otpType = 'ourSide';
                    // smsapi("admin", "otp_send", mobile_number, otp, `3 min`);
                    smsapi("admin", "onboarding_otp", mobile_number, "Distributor", otp, `3 min`);
                    await connection.query("INSERT INTO login SET ?", {
                        user_type: "Distributor",
                        unique_id: unique_id,
                        mobile_number: mobile_number,
                        otp: hashedOTP,
                        status: "6",
                        // customer_id: Math.floor(100000 + Math.random() * 900000).toString(),
                        // application_id: Math.floor(100000 + Math.random() * 900000).toString(),
                        aadhar_number,
                        created_date: new Date(),
                        created_by: emp_id,
                        am_id: emp_id,
                    });

                }

                connection.release();
                return res.status(200).json({
                    status_code: "15",
                    status: "pending",
                    message: otpMessage,
                    unique_id: unique_id,
                    aadhar_number,
                    otpType,
                    access_key,

                });
            }
        } else {
            var otpMessage = '';
            var otpType = '';
            var access_key = '';
           

            if (!otpMessage && !otpType && !access_key) {
                otpMessage = 'Otp send From OurSide';
                otpType = 'ourSide';
                // smsapi("admin", "onboarding_otp", mobile_number, otp, `3 min`);
                smsapi("admin", "onboarding_otp", mobile_number, "Distributor", otp, `3 min`);
                await connection.query("INSERT INTO login SET ?", {
                    user_type: "Distributor",
                    unique_id: unique_id,
                    mobile_number: mobile_number,
                    otp: hashedOTP,
                    status: "6",
                    // customer_id: Math.floor(100000 + Math.random() * 900000).toString(),
                    // application_id: Math.floor(100000 + Math.random() * 900000).toString(),
                    aadhar_number,
                    created_date: new Date(),
                    created_by: emp_id,
                    am_id: emp_id,
                });

            }

            connection.release();
            return res.status(200).json({
                status_code: "15",
                status: "success",
                message: otpMessage,
                unique_id: unique_id,
                aadhar_number,
                otpType,
                access_key,


            });
        }
    } catch (error) {
        console.error(error.message);
        return res.status(500).json({
            status_code: "2",
            status: "failed",
            message: "Internal Server Error",
        });
    } finally {
        connection.release();
    }
});


router.post("/otp-verification", requireStaffLogin, async (req, res) => {
    const connection = await poolPromise().getConnection();

    try {
        const {
            unique_id,
            otp,
            aadhar_number,
            otpType,
            access_key,
        } = req.body;
        const emp_id = req.staff.emp_id;



        const [userData] = await connection.query(
            "SELECT * FROM login WHERE unique_id = ?",
            [unique_id]
        );

        if (userData.length === 0) {
            connection.release();
            return res.status(200).json({
                status_code: "2",
                status: "failed",
                message: "Invalid User",
            });
        } else {

            if (userData[0].status === "5") {
                connection.release();
                return res.status(200).json({
                    status_code: "2",
                    status: "failed",
                    message: "Distributor already verified.",
                });
            }
        }

        if (otpType.toLowerCase() === "addhar")
        {
            if (!access_key)
            {
                return res.status(200).json({
                    status_code: "2",
                    status: "failed",
                    message: "access_key not provided"
                })
            }
            const getAadharFileResult = await getAdhaarFile(aadhar_number, otp, access_key);
            if (getAadharFileResult.response_status_id === 0) {

                const application_id = Date.now();
                const customer_id = String(emp_id).slice(0, 4) +
                    Math.floor(10000 + Math.random() * 90000).toString();

                // Update customer_id, application_id, and status in login_data table
                await connection.query(
                    "UPDATE `login` SET customer_id = ?, application_id = ?, status = ? WHERE unique_id = ?",
                    [customer_id, application_id, "5", unique_id]
                );



                console.log(userData[0].status);
                return res.status(200).json({
                    status_code: "21",
                    status: "success",
                    data: {
                        unique_id,
                        name: getAadharFileResult.data.name,
                        dob: getAadharFileResult.data.dob,
                        gender: getAadharFileResult.data.gender,
                        aadhar_number,
                        residential_address: getAadharFileResult.data.combinedAddress
                    }
                })
            }
            else
            {
                return res.json({
                    status_code: "2",
                    status: "failed",
                    message:"Incorrect OTP"
                })
            }
        } else {
            if (otpType.toLowerCase() === "ourside") {
                // Check if the OTP is valid
                const [userData] = await connection.query(
                    "SELECT * FROM login WHERE unique_id = ? AND otp = ?",
                    [unique_id, md5(SALT.concat(otp))]
                );

                if (userData.length === 0) {
                    connection.release();
                    return res.status(200).json({
                        status_code: "2",
                        status: "failed",
                        message: "Invalid OTP.",
                    });
                }

                // OTP is successfully verified, generate customer id and update status in login_data table

                const application_id = Date.now();
                const customer_id =
                    String(emp_id).slice(0, 4) +
                    Math.floor(10000 + Math.random() * 90000).toString();

                // Update customer_id, application_id, and status in login_data table
                await connection.query(
                    "UPDATE `login` SET customer_id = ?, application_id = ?, status = ? WHERE unique_id = ?",
                    [customer_id, application_id, "5", unique_id]
                );

                connection.release();

                return res.status(200).json({
                    status_code: "21",
                    status: "success",
                    message: "Onboard Distributor.",
                    data: {
                        unique_id,
                        name: "",
                        dob: "",
                        gender: "",
                        aadhar_number,
                        residential_address:""
                    }
                });
            }
        }

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            status_code: "2",
            status: "failed",
            message: "Internal Server Error",
        });
    } finally {
        connection.release();
    }
});

router.post("/distributor-onboard", requireStaffLogin, async (req, res) => {
    const connection = await poolPromise().getConnection();
    const connection2 = await poolPromise2().getConnection();

    try {
        const {
            // application_id,
            unique_id,
            name,
            email,
            dob,
            gender,
            pan_number,
            aadhar_number,
            residential_address,
            entity_type,
            trade_name,
            legal_name, //
            gst_number,//
            date_of_registration,//
            registration_no,//
            offices_address,
        } = req.body;
       
        // Check if the distributor with the given application id exists
        const [existingDistributor] = await connection.query(
            "SELECT * FROM distributor WHERE pan_number = ?",
            [pan_number]
        );
         
        const [loginDistributor] = await connection.query(
            "SELECT * FROM login WHERE unique_id = ?",
            [unique_id]
        );
   
        if (loginDistributor.length === 0) {
            connection.release();
            return res.status(200).json({
                status_code: "2",
                status: "failed",
                message: "Distributor with the provided application id does not already exists.",
            });
        }
        // const unique_id = loginDistributor[0].unique_id;

        if (existingDistributor.length > 0) {
            connection.release();
            return res.status(200).json({
                status_code: "2",
                status: "failed",
                message: "Distributor with the provided application id already exists.",
            });
        }
        
        
        // Update distributor data in the distributor table
        await connection.query(
            "INSERT INTO distributor (unique_id, name, email, date_of_birth, pan_number, aadhar_number, residential_address, entity_type, trade_name, legal_name, gst_number, date_of_registration, registration_no, offices_address, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [
                unique_id,
                name,
                email,
                dob,
                pan_number,
                aadhar_number,
                JSON.stringify(residential_address),
                entity_type,
                trade_name,
                legal_name,
                gst_number,
                date_of_registration,
                registration_no,
                JSON.stringify(offices_address),
                "KYC-Not Submitted", // Default status
            ]
        );

        // Update wallet data in the wallet table
        await connection2.query(
            "INSERT INTO wallets (user_type, unique_id, wallet, hold, unsettle, createdAt, status) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP(), ?)",
            ["Distributor", unique_id, 0.00, 0, 0, "Enable"]
        );

        // Update status in the login_data table
        await connection.query(
            "UPDATE login SET status = ? WHERE unique_id = ?",
            ["4", unique_id]
        );

        connection.release();

        return res.status(200).json({
            status_code: "22",
            status: "success",
            unique_id,
            message: "Update Agent KYC Document ",
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            status_code: "2",
            status: "failed",
            message: "Internal Server Error",
        });
    } finally {
        connection.release();
        connection2.release();
    }
});
router.post("/onboard-distributor-kyc", requireStaffLogin, upload2.fields([{
            name: "photo",
            maxCount: 1
        },
        {
            name: "pan_front",
            maxCount: 1
        },
        {
            name: "aadhar_front",
            maxCount: 1
        },
        {
            name: "aadhar_back",
            maxCount: 1
        },
        {
            name: "board_resolution",
            maxCount: 1
        },
        {
            name: "registration_certificate",
            maxCount: 1
        },
    ]),
    async (req, res) => {
        const connection = await poolPromise().getConnection();

        try {
            const {
                unique_id
            } = req.body;

            const [loginDistributor] = await connection.query(
                "SELECT * FROM login WHERE unique_id = ?",
                [unique_id]
            );
          

            if (loginDistributor.length === 0) {
                connection.release();
                return res.status(200).json({
                    status_code: "2",
                    status: "failed",
                    message: "Distributor with the provided application id does not already exists.",
                });
            }
            // const unique_id = loginDistributor[0].unique_id;
            const isEmpty = Object.keys(req.files).length === 0;
            console.log(Object.keys(req.files))
            console.log(req.files)
            const mandatory_documents = Object.keys(req.files);
            const includesAll = mandatory_documents.includes('photo') && mandatory_documents.includes('pan_front')  && mandatory_documents.includes('aadhar_front') && mandatory_documents.includes('aadhar_back') 
            if (includesAll === false) {
                connection.release();
                return res.status(422).json({
                    status_code: "2",
                    status: "failed",
                    message: "Please provide required files",
                });
            }
            // Check if the distributor with the given application id exists
            const [existingDistributor] = await connection.query(
                "SELECT * FROM distributor WHERE unique_id = ?",
                [unique_id]
            );
              
            if (existingDistributor.length === 0) {
                connection.release();
                return res.status(200).json({
                    status_code: "2",
                    status: "failed",
                    message: "Distributor with the provided application id does not exist.",
                });
            }
            

            // Upload KYC documents and get file paths
            const photoPath = req.files["photo"] ?
                req.files["photo"][0].filename :
                null;
            const panFrontPath = req.files["pan_front"] ?
                req.files["pan_front"][0].filename :
                null;
            const aadharFrontPath = req.files["aadhar_front"] ?
                req.files["aadhar_front"][0].filename :
                null;
            const aadharBackPath = req.files["aadhar_back"] ?
                req.files["aadhar_back"][0].filename :
                null;
            const boardResolutionPath = req.files["board_resolution"] ?
                req.files["board_resolution"][0].filename :
                null;
            const regCertificatePath = req.files["registration_certificate"] ?
                req.files["registration_certificate"][0].filename :
                null;

            // Update distributor data in the distributor table
            await connection.query(
                "UPDATE distributor SET photo = ?, pan_front = ?, aadhar_front = ?, aadhar_back = ?, board_resolution = ?, reg_certificate = ?, status = ? WHERE unique_id = ?",
                [
                    photoPath,
                    panFrontPath,
                    aadharFrontPath,
                    aadharBackPath,
                    boardResolutionPath,
                    regCertificatePath,
                    "KYC-Pending",
                    unique_id,
                ]
            );

            // Change status code in login_data table from 4 to 3
            await connection.query(
                "UPDATE login SET status = ? WHERE unique_id = ?",
                ["3", unique_id]
            );

            connection.release();

            return res.status(200).json({
                status_code: "23",
                status: "success",
                unique_id,
                message: "Assign Agent Territory",
            });
        } catch (error) {
            console.error(error);
            return res.status(500).json({
                status_code: "2",
                status: "failed",
                message: "Internal Server Error",
            });
        } finally {
            connection.release();
        }
    }
);


router.post("/assign-territory", requireStaffLogin, async (req, res) => {
    const connection = await poolPromise().getConnection();



    //if nahi mila to fetch locaion krke api he usme data fetch krke area table me store krna he
    //if mila to distrcit match krna terrority table se mtch huaa to pincode district status terroritory table me insurt hoga 

    try {
        const {
            unique_id,
            territory
        } = req.body; // territory:"pin"
        const asm_unique_id = req.staff.unique_id;
        console.log(asm_unique_id);
        let inserted = false;
        const [usertype] = await connection.query(
            "SELECT user_type FROM territory WHERE unique_id = ?",
            [asm_unique_id]
        );
        if (!(usertype[0].user_type === "001" || usertype[0].user_type === "002"))
        {
            return res.json({
                status_code: "2",
                status: "failed",
                message:"Only ASM or SM can assign territory"
            })
                }
        const [loginDistributor] = await connection.query(
            "SELECT * FROM login WHERE unique_id = ? AND status = ?",
            [unique_id, "3"]
        );
       
        if (loginDistributor.length === 0) {
            connection.release();
            return res.status(200).json({
                status_code: "2",
                status: "failed",
                message: "Distributor with the provided unique id does not already exists or status not match.",
            });
        }
        
        const [DistributorData] = await connection.query(
            "SELECT name FROM distributor WHERE unique_id = ?",
            [unique_id]
        );
        if (DistributorData.length === 0) {
            connection.release();
            return res.status(200).json({
                status_code: "2",
                status: "failed",
                message: "Distributor with the provided unique id does not already exists .",
            });
        }
        // const [alreadyAssigned] = await connection.query(
        //     "SELECT COUNT(*) as count FROM territory WHERE unique_id = ? AND status = ? and user_type = ? ",
        //     [unique_id,"Enable", "Distributor"]
        // );

        // if (alreadyAssigned[0].count) {
        
        //     return res.status(200).json({
        //         status_code: "2",
        //         status: "failed",
        //         message: "Territory already assigned to another distributor",
        //     });
        // }
      
        if (typeof (territory) === "object")
        {
            // 
            const present_territories = [];
            for (const pincode of territory) {
                const [exists] = await connection.query('SELECT COUNT(*) AS count FROM territory WHERE pincode = ?', [pincode]);
                if (exists[0].count) {
                    present_territories.push(pincode);
                } 
              }
            if (present_territories.length > 0)
            {
                return res.json({
                    status_code: "2",
                    status: "failed",
                    message:`Distributor for pincode ${[present_territories.map(t=> t).join(", ")]} already assigned`
                })
            }

           
            const [areadata] = await connection.query("SELECT * FROM area WHERE pincode IN (?)", [territory]);
            const [ASMteritory] = await connection.query(
                "SELECT district , state FROM territory WHERE unique_id = ? AND status = 'Enable' ",
                [asm_unique_id, "3"]
                );
                if (ASMteritory.length === 0) {
                    return res.status(200).json({
                        status_code: "2",
                        status: "failed",
                        message: "ASM/SM territory not found.",
                    });
                }
            if (areadata.length === 0)
            {

            let pin_data;
            let check_data;
            try
            {
                pin_data = await Promise.all(territory.map(async (t) => await pin_code(Number(t))));
                check_data = pin_data[0][0]
            }
            catch (error)
            {
                return res.status(200).json({
                    status_code: "2",
                    status: "failed",
                    message: "Unable to find pincode",
                })
                }
                // return res.json({DATA:pin_data[0]})
                // const filteredDistrict = pin_data[0].filter(obj => ASMdata.includes(obj.district.toLowerCase()));
                var filteredDistrict = pin_data[0].filter(area => {
                    return ASMteritory.some(item => {
                        return item.district.toLowerCase() == area.district.toLowerCase() && item.state.toLowerCase() == area.state.toLowerCase()
                    })
                })
         
            
            if (filteredDistrict.length > 0)
            {
             
                const keysInOrder = ['pincode', 'area_name', 'district', 'state'];
                var bulkInsertData = filteredDistrict.map(object =>
                    [unique_id, ...keysInOrder.map(key => object[key]), "Distributor", "Enable"]
                )
        
                //    return res.json({bulkInsertData})

            } else
            {
                return res.status(200).json({
                    status_code: "2",
                    status: "failed",
                    message: "ASM/SM territory not match with pin code.",
                })
            }
        
            for (const data of bulkInsertData)
            {
                const [unique_id, territory, area_name, district, state, distributor, enable] = data;

                try
                {
                    // Check if the combination already exists
                    const [datav] = await connection.query(`SELECT IF(status = 'Enable', COUNT(*), 0) as count FROM territory WHERE unique_id = ?  AND area = ? AND district = ? AND state = ?`, [unique_id, area_name, district, state]);
                    console.log(datav);
                    let countValue = datav[0].count || 0;
                    if (countValue === 0)
                    {
                        inserted = true;
                        // If the combination does not exist, insert the data
                        const [insertV] = await connection.query(
                            'INSERT INTO territory (unique_id, pincode, area, district, state, user_type, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
                            [unique_id, territory, area_name, district, state, distributor, enable]);

                        console.log('Data inserted successfully:', insertV);
                    } else
                    {
                        console.log('Combination already exists');
                    }
                } catch (error)
                {
                    console.error('Error processing data:', error);
                }
            }
            }
            else
            {
                
                
                
                // Getting List of areas that can be assigned by ASM based on 
                var filteredAreas = areadata.filter(area => {
                    return ASMteritory.some(item => {
                        return item.district.toLowerCase() == area.district.toLowerCase() && item.state.toLowerCase() == area.state.toLowerCase()
                    })
                })
                if (filteredAreas.length === 0)
                {
                    return res.status(200).json({
                        status_code: "2",
                        status: "failed",
                        message: "Cannot be assigned to territory",
                    })
                    }
              
                var bulkInsertData = filteredAreas.map(area => {
                    return [
                        unique_id,
                        area.pincode,
                        area.name,
                        area.district,
                        area.state,
                        "Distributor",
                        "Enable"
                    ]
                })
              
            for (const data of bulkInsertData)
            {
                const [unique_id, territory, area_name, district, state, distributor, enable] = data;

                try
                {
                    // Check if the combination already exists
                    const [datav] = await connection.query(`SELECT IF(status = 'Enable', COUNT(*), 0) as count FROM territory WHERE area = ? AND district = ? AND state = ?`, [area_name, district, state]);
                    let countValue = datav[0].count || 0;
                    console.log(countValue);
                    if (countValue === 0)
                    {
                        inserted = true;
                        // If the combination does not exist, insert the data
                        const [insertV] = await connection.query(
                            'INSERT INTO territory (unique_id, pincode, area, district, state, user_type, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
                            [unique_id, territory, area_name, district, state, distributor, enable]);

                        console.log('Data inserted successfully:', insertV);
                    } else
                    {
                        console.log('Combination already exists');
                    }
                } catch (error)
                {
                    console.error('Error processing data:', error);
                }
            }
            }
            
        }
        else
        {
        
         //area table search 
            const [areadata] = await connection.query("SELECT * FROM area WHERE pincode = ?", [territory])
            const [ASMteritory] = await connection.query(
                "SELECT district , state FROM territory WHERE unique_id = ? AND status = 'Enable' ",
                [asm_unique_id, "3"]
                );
                if (ASMteritory.length === 0) {
                    return res.status(200).json({
                        status_code: "2",
                        status: "failed",
                        message: "ASM/SM territory not found.",
                    });
            }
            const [exists] = await connection.query('SELECT COUNT(*) AS count FROM territory WHERE pincode = ? and status = ?', [territory, "Enable"]);
            if (exists[0].count) {
                return res.status(200).json({
                    status_code: "2",
                    status: "failed",
                    message: "Distributor has already been assigned for this territory",
                });
            } 
            // return res.json(areadata)
            if (areadata.length === 0)
            {
                let pin_data;
                let check_data;
                // third party  
                try
                {
                    
                
                    pin_data = await pin_code(Number(territory));
                    check_data = pin_data[0];
                } catch (error)
                {
                    return res.status(200).json({
                        status_code: "2",
                        status: "failed",
                        message: "Unable to find pincode",
                    })
                }
                
            
               
                var filteredDistrict = pin_data.filter(area => {
                    return ASMteritory.some(item => {
                        return item.district.toLowerCase() == area.district.toLowerCase() && item.state.toLowerCase() == area.state.toLowerCase()
                    })
                })
         
                // return res.json({filteredDistrict})
                if (filteredDistrict.length > 0)
                {
                    // console.log(pin_data, "dataaaaaaaaaaa");
                    // Extracting territory data for bulk insert
                    var bulkInsertData = pin_data.map(({
                        area_name,
                        district,
                        state
                    }) => [
                            unique_id,
                            String(territory),
                            area_name,
                            district,
                            state,
                            "Distributor",
                            "Enable",
                        ]);
    
                } else
                {
                    return res.status(200).json({
                        status_code: "2",
                        status: "failed",
                        message: "ASM/SM territory not match with pin code.",
                    })
                }
            for (const data of bulkInsertData)
                {
                    const [unique_id, territory, area_name, district, state, distributor, enable] = data;
    
                    try
                    {
                        // Check if the combination already exists
                        const [datav] = await connection.query(`SELECT IF(status = 'Enable', COUNT(*), 0) as count FROM territory WHERE unique_id = ?  AND area = ? AND district = ? AND state = ?`, [unique_id, area_name, district, state]);
                        let countValue = datav[0].count || 0;
                        if (countValue === 0)
                        {
                        inserted = true;

                            // If the combination does not exist, insert the data
                            const [insertV] = await connection.query(
                                'INSERT INTO territory (unique_id, pincode, area, district, state, user_type, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
                                [unique_id, territory, area_name, district, state, distributor, enable]);
    
                            console.log('Data inserted successfully:', insertV);
                        } else
                        {
                            console.log('Combination already exists');
                        }
                    } catch (error)
                    {
                        console.error('Error processing data:', error);
                    }
                }
            }
            else
            {
               
                
                
                // Getting List of areas that can be assigned by ASM based on 
                var filteredAreas = areadata.filter(area => {
                    return ASMteritory.some(item => {
                        return item.district.toLowerCase() == area.district.toLowerCase() && item.state.toLowerCase() == area.state.toLowerCase()
                    })
                })
                if (filteredAreas.length === 0)
                {
                    return res.status(200).json({
                        status_code: "2",
                        status: "failed",
                        message: "ASM/SM territory not match with pin code.",
                    })
                    }
                // return res.json({filteredAreas,ASMteritory})
                var bulkInsertData = filteredAreas.map(area => {
                    return [
                        unique_id,
                        area.pincode,
                        area.name,
                        area.district,
                        area.state,
                        "Distributor",
                        "Enable"
                    ]
                })
              

            for (const data of bulkInsertData)
            {
                const [unique_id, territory, area_name, district, state, distributor, enable] = data;

                try
                {
                    // Check if the combination already exists
                    const [datav] = await connection.query(`SELECT IF(status = 'Enable', COUNT(*), 0) as count FROM territory WHERE area = ? AND district = ? AND state = ?`, [area_name, district, state]);
                    let countValue = datav[0].count || 0;
                    console.log(countValue);
                    if (countValue === 0)
                    {
                        inserted = true;

                        // If the combination does not exist, insert the data
                        const [insertV] = await connection.query(
                            'INSERT INTO territory (unique_id, pincode, area, district, state, user_type, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
                            [unique_id, territory, area_name, district, state, distributor, enable]);

                        console.log('Data inserted successfully:', insertV);
                    } else
                    {
                        console.log('Combination already exists');
                    }
                } catch (error)
                {
                    console.error('Error processing data:', error);
                }
            }
            }
           
        }
       
        //area table search 
        // const [aredata] = await connection.query(
        //     "SELECT * FROM area WHERE pincode = ?",
        //     [territory]
        // );

        // if(aredata.length ==0){
        //     // return res.send('rea not foudn')

        //     const [aredata] = await connection.query(
        //         "SELECT * FROM location  WHERE pincode = ?",
        //         [territory]
        //     );
    
        // }

        
       
        
        
        // const unique_id = loginDistributor[0].unique_id;
        if (inserted === false)
        {
            return res.status(200).json({
                status_code: "2",
                status: "failed",
                message: "Distributor Not  Registered",
            });
        }
      
        // Change status code in login_data table from 3 to 2
        await connection.query("UPDATE login SET status = ? WHERE unique_id = ?", [
            "2",
            unique_id,
        ]);

        // Send OTP to distributor mobile
        smsapi("admin", "distributor_on-boarded", loginDistributor[0].mobile_number, DistributorData[0].name);

        connection.release();
        
            
            return res.status(200).json({
                status_code: "1",
                status: "success",
                message: "Distributor Successfully Registered",
            });
        
       
        } catch (error) {
        console.error(error);
        return res.status(500).json({
            status_code: "2",
            status: "failed",
            message: "Internal Server Error",
        });
    } finally {
        connection.release();
    }
});

// router.get("/fetch_distributor", requireStaffLogin, async (req, res) => {

//     const emp_id = req.staff.emp_id;
//     const designation_id = req.staff.designation_id;
   
//     // Use promise-based connection
//     const connection = await poolPromise().getConnection();
//     try {
        
//         if (designation_id === "001")
//         {
//             const [results] = await connection.query("SELECT district,state FROM territory where unique_id = ?", [req.staff.unique_id]);
//             const [distRows] = await connection.query("SELECT DISTINCT(unique_id) FROM territory WHERE (district, state) IN (?) AND unique_id <> ?", [results.map(result => [result.district, result.state]), req.staff.unique_id]);
//             if (distRows.length === 0)
//             {
//                 return res.json({
//                     status_code: "2",
//                     status: "failed",
//                     message:"No distributor found"
//                 })
//             }
//             const uniqueIds = distRows.map(obj => obj.unique_id);
//             // return res.json({results})

//             return res.json({uniqueIds})
//             const query = `
//             SELECT l.unique_id,l.customer_id,d.name,d.trade_name,l.created_date,l.status FROM login l LEFT JOIN distributor d ON d.unique_id = l.unique_id 
//     WHERE 
//         l.user_type = 'Distributor' 
//         AND l.unique_id IN ('${uniqueIds.join("','")}')
//     `;
    
//     // Execute the query
//     const [rows] = await connection.query(query);
//             // for(let )
           
//             return res.status(200).json({
//                 status_code: "1",
//                 status: "success",
//                 data: rows
//             });   
//         }
//         else if (designation_id === "002")
//         {
//             const [distributorRows] = await connection.query("SELECT l.unique_id,l.customer_id,d.name,d.trade_name,l.created_date,l.status FROM login l LEFT JOIN distributor d ON d.unique_id = l.unique_id where l.am_id = ? and l.user_type = ? and l.unique_id <> ? ", [req.staff.emp_id, "Distributor", req.staff.unique_id]);
//             return res.status(200).json({
//                 status_code: "1",
//                 status: "success",
//                 data: distributorRows
//             });   
//         }
        
//     } catch (error) {
//         console.error(error);
//         return res.status(500).json({
//             status_code: "2",
//             status: "fail",
//             message: "Internal Server Error"
//         });
//     } finally {
//         if (connection) {
//             await connection.release();
//         }
//     }
// });
router.get("/fetch_distributor", requireStaffLogin, async (req, res) => {

    const emp_id = req.staff.emp_id;
    const designation_id = req.staff.designation_id;
   
    // Use promise-based connection
    const connection = await poolPromise().getConnection();
    try {
        
       
      // Execute the query
    const [login_result] = await connection.query("SELECT l.unique_id,l.customer_id,d.name,d.trade_name,l.created_date,l.status FROM login l LEFT JOIN distributor d on l.unique_id = d.unique_id where created_by = ? ", emp_id);
            // for(let )
        if (login_result.length === 0)
        {
            return res.status(500).json({
                status_code: "2",
                status: "failed",
                message: "No Distributor Found"
            });
             }
            return res.status(200).json({
                status_code: "1",
                status: "success",
                data: login_result
            });   
        
       
        
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            status_code: "2",
            status: "fail",
            message: "Internal Server Error"
        });
    } finally {
        if (connection) {
            await connection.release();
        }
    }
});
router.post("/add-territory", requireStaffLogin, async (req, res) => {
    const connection = await poolPromise().getConnection();

    try {
        const {
            unique_id,
            territory
        } = req.body; // territory:"pin"
        const asm_unique_id = req.staff.unique_id;
        let inserted = false;
        console.log(asm_unique_id);
        const [usertype] = await connection.query(
            "SELECT user_type FROM territory WHERE unique_id = ?",
            [asm_unique_id]
        );
        if (!(usertype[0].user_type === "001" || usertype[0].user_type === "002"))
        {
            return res.json({
                status_code: "2",
                status: "failed",
                message:"Only ASM or SM can assign territory"
            })
                }

        const [loginDistributor] = await connection.query(
            "SELECT * FROM login WHERE unique_id = ? AND am_id ",
            [unique_id,req.staff_emp_id]
        );

        if (loginDistributor.length === 0) {
            connection.release();
            return res.status(200).json({
                status_code: "2",
                status: "failed",
                message: "Distributor with the provided unique id does not already exists or am_id dont match",
            });
        }
        const [DistributorData] = await connection.query(
            "SELECT name FROM distributor WHERE unique_id = ?",
            [unique_id]
        );
        if (DistributorData.length === 0) {
            connection.release();
            return res.status(200).json({
                status_code: "2",
                status: "failed",
                message: "Distributor with the provided unique id does not already exists .",
            });
        }

        // const [alreadyAssigned] = await connection.query(
        //     "SELECT COUNT(*) as count FROM territory WHERE unique_id = ? AND status = ? and user_type = ? ",
        //     [unique_id,"Enable", "Distributor"]
        // );

        // if (alreadyAssigned[0].count) {
        
        //     return res.status(200).json({
        //         status_code: "2",
        //         status: "failed",
        //         message: "Territory already assigned to another distributor",
        //     });
        // }
        if (typeof (territory) === "object")
        {
            
            // 
            const present_territories = [];
            for (const pincode of territory) {
                const [exists] = await connection.query('SELECT COUNT(*) AS count FROM territory WHERE pincode = ? and status = ?', [pincode,"Enable"]);
                if (exists[0].count) {
                    present_territories.push(pincode);
                } 
            }
            
            if (present_territories.length > 0)
            {
                return res.json({
                    status_code: "2",
                    status: "failed",
                    message:`Distributor for pincode ${[present_territories.map(t=> t).join(", ")]} already assigned`
                })
            }
            
           
            const [areadata] = await connection.query("SELECT * FROM area WHERE pincode IN (?)", [territory]);
            const [ASMteritory] = await connection.query(
                "SELECT district , state FROM territory WHERE unique_id = ? AND status = 'Enable' ",
                [asm_unique_id, "3"]
                );
                if (ASMteritory.length === 0) {
                    return res.status(200).json({
                        status_code: "2",
                        status: "failed",
                        message: "ASM/SM territory not found.",
                    });
                }
            if (areadata.length === 0)
            {

            let pin_data;
            let check_data;
            try
            {
                pin_data = await Promise.all(territory.map(async (t) => await pin_code(Number(t))));
                check_data = pin_data[0][0]
            }
            catch (error)
            {
                return res.status(200).json({
                    status_code: "2",
                    status: "failed",
                    message: "Unable to find pincode",
                })
                }
                // return res.json({DATA:pin_data[0]})
                // const filteredDistrict = pin_data[0].filter(obj => ASMdata.includes(obj.district.toLowerCase()));
                var filteredDistrict = pin_data[0].filter(area => {
                    return ASMteritory.some(item => {
                        return item.district.toLowerCase() == area.district.toLowerCase() && item.state.toLowerCase() == area.state.toLowerCase()
                    })
                })
         
            
            if (filteredDistrict.length > 0)
            {
             
                const keysInOrder = ['pincode', 'area_name', 'district', 'state'];
                var bulkInsertData = filteredDistrict.map(object =>
                    [unique_id, ...keysInOrder.map(key => object[key]), "Distributor", "Enable"]
                )
        
                //    return res.json({bulkInsertData})

            } else
            {
                return res.status(200).json({
                    status_code: "2",
                    status: "failed",
                    message: "Incorrect territory Selected",
                })
                }
               
        
            for (const data of bulkInsertData)
            {
                const [unique_id, territory, area_name, district, state, distributor, enable] = data;

                try
                {
                    // Check if the combination already exists
                    const [datav] = await connection.query(`SELECT IF(status = 'Enable', COUNT(*), 0) as count FROM territory WHERE unique_id = ?  AND area = ? AND district = ? AND state = ? `, [unique_id, area_name, district, state]);
                    console.log(datav);
                    let countValue = datav[0].count || 0;
                    if (countValue === 0)
                    {
                        inserted = true;
                        // If the combination does not exist, insert the data
                        const [insertV] = await connection.query(
                            'INSERT INTO territory (unique_id, pincode, area, district, state, user_type, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
                            [unique_id, territory, area_name, district, state, distributor, enable]);

                        console.log('Data inserted successfully:', insertV);
                    } else
                    {
                        console.log('Combination already exists');
                    }
                } catch (error)
                {
                    console.error('Error processing data:', error);
                }
            }
            }
            else
            {
                
                
                
                // Getting List of areas that can be assigned by ASM based on 
                var filteredAreas = areadata.filter(area => {
                    return ASMteritory.some(item => {
                        return item.district.toLowerCase() == area.district.toLowerCase() && item.state.toLowerCase() == area.state.toLowerCase()
                    })
                })

                if (filteredAreas.length === 0)
                {
                    return res.status(200).json({
                        status_code: "2",
                        status: "failed",
                        message: "ASM/SM territory not match with pin code.",
                    })
                }
              
                var bulkInsertData = filteredAreas.map(area => {
                    return [
                        unique_id,
                        area.pincode,
                        area.name,
                        area.district,
                        area.state,
                        "Distributor",
                        "Enable"
                    ]
                })
              
            for (const data of bulkInsertData)
            {
                const [unique_id, territory, area_name, district, state, distributor, enable] = data;

                try
                {
                    // Check if the combination already exists
                    const [datav] = await connection.query(`SELECT IF(status = 'Enable', COUNT(*), 0) as count FROM territory WHERE area = ? AND district = ? AND state = ? `, [area_name, district, state]);
                    let countValue = datav[0].count || 0;
                    console.log(countValue);
            
                    if (countValue === 0)
                    {
                        inserted = true;

                        // If the combination does not exist, insert the data
                        const [insertV] = await connection.query(
                            'INSERT INTO territory (unique_id, pincode, area, district, state, user_type, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
                            [unique_id, territory, area_name, district, state, distributor, enable]);

                        console.log('Data inserted successfully:', insertV);
                    } else
                    {
                        console.log('Combination already exists');
                    }
                } catch (error)
                {
                    console.error('Error processing data:', error);
                }
            }
            }
            
        }
        else
        {
        
         //area table search 
            const [areadata] = await connection.query("SELECT * FROM area WHERE pincode = ?", [territory])
            const [ASMteritory] = await connection.query(
                "SELECT district , state FROM territory WHERE unique_id = ? AND status = 'Enable' ",
                [asm_unique_id, "3"]
                );
                if (ASMteritory.length === 0) {
                    return res.status(200).json({
                        status_code: "2",
                        status: "failed",
                        message: "ASM/SM territory not found.",
                    });
            }
            const [exists] = await connection.query('SELECT COUNT(*) AS count FROM territory WHERE pincode = ? and status = ?', [territory, "Enable"]);
            if (exists[0].count) {
                return res.status(200).json({
                    status_code: "2",
                    status: "failed",
                    message: "Distributor has already been assigned for this territory",
                });
            } 
            // return res.json(areadata)
            if (areadata.length === 0)
            {
                let pin_data;
                let check_data;
                // third party  
                try
                {
                    
                
                    pin_data = await pin_code(Number(territory));
                    check_data = pin_data[0];
                } catch (error)
                {
                    return res.status(200).json({
                        status_code: "2",
                        status: "failed",
                        message: "Unable to find pincode",
                    })
                }
                
            
               
                var filteredDistrict = pin_data.filter(area => {
                    return ASMteritory.some(item => {
                        return item.district.toLowerCase() == area.district.toLowerCase() && item.state.toLowerCase() == area.state.toLowerCase()
                    })
                })
         
                // return res.json({filteredDistrict})
                if (filteredDistrict.length > 0)
                {
                    // console.log(pin_data, "dataaaaaaaaaaa");
                    // Extracting territory data for bulk insert
                    var bulkInsertData = pin_data.map(({
                        area_name,
                        district,
                        state
                    }) => [
                            unique_id,
                            String(territory),
                            area_name,
                            district,
                            state,
                            "Distributor",
                            "Enable",
                        ]);
    
                } else
                {
                    return res.status(200).json({
                        status_code: "2",
                        status: "failed",
                        message: "ASM/SM territory not match with pin code.",
                    })
                }
            for (const data of bulkInsertData)
                {
                    const [unique_id, territory, area_name, district, state, distributor, enable] = data;
    
                    try
                    {
                        // Check if the combination already exists
                        const [datav] = await connection.query(`SELECT IF(status = 'Enable', COUNT(*), 0) as count FROM territory WHERE unique_id = ?  AND area = ? AND district = ? AND state = ?`, [unique_id, area_name, district, state]);
                        let countValue = datav[0].count || 0;
                        if (countValue === 0)
                        {
                        inserted = true;

                            // If the combination does not exist, insert the data
                            const [insertV] = await connection.query(
                                'INSERT INTO territory (unique_id, pincode, area, district, state, user_type, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
                                [unique_id, territory, area_name, district, state, distributor, enable]);
    
                            console.log('Data inserted successfully:', insertV);
                        } else
                        {
                            console.log('Combination already exists');
                        }
                    } catch (error)
                    {
                        console.error('Error processing data:', error);
                    }
                }
            }
            else
            {
               
                
                
                // Getting List of areas that can be assigned by ASM based on 
                var filteredAreas = areadata.filter(area => {
                    return ASMteritory.some(item => {
                        return item.district.toLowerCase() == area.district.toLowerCase() && item.state.toLowerCase() == area.state.toLowerCase()
                    })
                })
                if (filteredAreas.length === 0)
                {
                    return res.status(200).json({
                        status_code: "2",
                        status: "failed",
                        message: "ASM/SM territory not match with pin code.",
                    })
                    }
                // return res.json({filteredAreas,ASMteritory})
                var bulkInsertData = filteredAreas.map(area => {
                    return [
                        unique_id,
                        area.pincode,
                        area.name,
                        area.district,
                        area.state,
                        "Distributor",
                        "Enable"
                    ]
                })
              

            for (const data of bulkInsertData)
            {
                const [unique_id, territory, area_name, district, state, distributor, enable] = data;

                try
                {
                    // Check if the combination already exists
                    const [datav] = await connection.query(`SELECT IF(status = 'Enable', COUNT(*), 0) as count FROM territory WHERE area = ? AND district = ? AND state = ?`, [area_name, district, state]);
                    let countValue = datav[0].count || 0;
                    console.log(countValue);
                    if (countValue === 0)
                    {
                        inserted = true;

                        // If the combination does not exist, insert the data
                        const [insertV] = await connection.query(
                            'INSERT INTO territory (unique_id, pincode, area, district, state, user_type, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
                            [unique_id, territory, area_name, district, state, distributor, enable]);

                        console.log('Data inserted successfully:', insertV);
                    } else
                    {
                        console.log('Combination already exists');
                    }
                } catch (error)
                {
                    console.error('Error processing data:', error);
                }
            }
            }
           
        }

        if (inserted === false)
        {
            return res.status(200).json({
                status_code: "2",
                status: "failed",
                message: "Territory Currently Not Available",
            });
        }



        return res.status(200).json({
            status_code: "1",
            status: "success",
            message: "New Territory Successfully Added",
        });
    
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            status_code: "2",
            status: "failed",
            message: "Internal Server Error",
        });
    } finally {
        connection.release();
    }
});

router.post("/remove-territory", requireStaffLogin, async (req, res) => {
    const connection = await poolPromise().getConnection();

    try {
        const {
            unique_id,
            territory
        } = req.body;// territory:"pin"
        const asm_unique_id = req.staff.unique_id;
        let removed = false;
        
        const [usertype] = await connection.query(
            "SELECT user_type FROM territory WHERE unique_id = ?",
            [asm_unique_id]
        );
        if (!(usertype[0].user_type === "001" || usertype[0].user_type === "002"))
        {
            return res.json({
                status_code: "2",
                status: "failed",
                message:"Only ASM or SM can remove territory"
            })
        }
        
        const [loginDistributor] = await connection.query(
            "SELECT * FROM login WHERE unique_id = ? AND am_id ",
            [unique_id,req.staff_emp_id]
        );

        if (loginDistributor.length === 0) {
            connection.release();
            return res.status(200).json({
                status_code: "2",
                status: "failed",
                message: "Distributor with the provided unique id does not already exists or am_id dont match",
            });
        }
        if (typeof (territory) === "object")
        {
            const present_territories = [];
            for (const pincode of territory)
            {
                const [exists] = await connection.query('SELECT COUNT(*) AS count FROM territory WHERE pincode = ? and status = ? and unique_id = ?', [pincode, "Enable", unique_id]);
                console.log(exists[0]);
                if (exists[0].count)
                {
                    present_territories.push(pincode);
                }
            }
           
        
        
            if (present_territories.length === 0)
            {
                return res.json({
                    status_code: "2",
                    status: "failed",
                    message: `Distributor has not been assigned for pincode ${[present_territories.map(t => t).join(", ")]}  `
                })
            }
                
                   const [updatedResult] = await connection.query(`UPDATE territory SET status = ? WHERE pincode IN (?) `, ["Disable", present_territories]);

                   if (updatedResult.affectedRows > 0) {
                    return res.status(200).json({
                        status_code: "1",
                        status: "success",
                        message: "Distributor territory successfully removed",
                    });
            
                         }
                   else
                   {
                    return res.status(200).json({
                        status_code: "2",
                        status: "success",
                        message: "Distributor territory not  removed",
                    });
                       
                }
            
                
        
        }
        else
        {
            const [exists] = await connection.query('SELECT COUNT(*) AS count FROM territory WHERE pincode = ? and status = ? and unique_id = ?', [territory, "Enable", unique_id]);
            if (exists[0].count)
            {
                const [updatedResult] = await connection.query(`UPDATE territory SET status = ? WHERE pincode  = ?`, ["Disable", territory]);

                if (updateResult.affectedRows > 0) {
                 return res.status(200).json({
                     status_code: "1",
                     status: "success",
                     message: "Distributor territory successfully removed",
                 });
         
                      }
                else
                {
                 return res.status(200).json({
                     status_code: "2",
                     status: "success",
                     message: "Distributor territory not  removed",
                 });
                    
             }
            }
            else
            {
                return res.json({
                    status_code: "2",
                    status: "failed",
                    message:`Distributor has not been assigned for pincode ${territory}  `
                })

            }
        }

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            status_code: "2",
            status: "failed",
            message: "Internal Server Error",
        });
    } finally {
        connection.release();
    }
});

//Onboard New Distributor end

//Customer Services Point & Merchant Registered  start
router.get("/myterritory", requireStaffLogin, async (req, res) => { 
    const connection = await poolPromise().getConnection();
    const { unique_id } = req.staff;
    const count_query = 'SELECT COUNT(*) AS count FROM territory WHERE unique_id = ?';
    const [count_results] = await connection.query(count_query, [unique_id]);
    if (count_results[0].count < 1)
    {
        return res.status(500).json({
            status_code: "2",
            status: "failed",
            message:"Employee has no territory"
        })
    }
    const query = 'SELECT *  FROM territory WHERE unique_id = ?';
    const [results] = await connection.query(query, [unique_id]);
    const extractedResults = results.map(({ area, district, state }) => ({ area, district, state }));
    
    return res.json({
         status_code: "1",
        status: "success",
        data:extractedResults
    })
})

router.get("/search-package/:user_type", requireStaffLogin, async (req, res) => {
    const connection2 = await poolPromise2().getConnection();
    try
    {
        const user_type = req.params.user_type;
        if (user_type.toLowerCase() !== "csp" && user_type.toLowerCase() !== "merchant")
        {
            return res.json({
                status_code: "2",
                status: "failed",
                message:`User type ${user_type} not allowed`
            })
        }
        const [scheme_result] = await connection2.query("SELECT * FROM schemes where total <> ? and userType = ?",
            [0 ,user_type])
        
        if (scheme_result.length == 0)
        {
            return res.json({
                status_code: "2",
                status: "failed",
                message:`No package found for  user_type ${user_type}`
            })
            }
            return res.json({
                status_code: "1",
                status: "success",
                message:scheme_result
            })
    } catch (error) {
        console.log(error)
        return res.json({
            status_code: "2",
            status: "failed",
            message:`Internal Server Error`
        })
    }

    finally
    {
        connection2.release();
    }
})
router.post("/search-merchant", requireStaffLogin, async (req, res) => {

    const connection = await poolPromise2().getConnection();
    try {
        const {
            user_type,
            mobile_number
        } = req.body;

    
        
        if (user_type === "csp" || user_type === "merchant")
        {
            const [userResult] = await connection.query(
                "SELECT * FROM auths WHERE user_type = ? AND mobile = ?",
                [user_type, mobile_number]
            );
        
            if (userResult.length > 0)
            {
                const user = userResult[0];
                console.log(user.id);
                switch (user.status)
                {
                    case "7":
                        const otp = Math.floor(100000 + Math.random() * 900000).toString();
                        const saltedOTP = SALT.concat(otp);
                        const hashedOTP =  md5(saltedOTP) ;
                        const auth_time = moment().format('YYYY-MM-DD HH:mm:ss')
                        const resultAuthData =   await connection.query(
                            "UPDATE auths SET otp = ? WHERE id = ?",
                            [hashedOTP, user.id]
                        );
                     
                            //  await smsapi("admin", "onboarding_code", mobile_number, otp, `3 min`);
                        await smsapi("admin", "onboarding_otp", mobile_number, user.user_type, otp, `3 min`);
                        
                        return res.status(200).json({
                            status_code: "12",
                            status: "otp-send",
                            unique_id: user.unique_id,
                            message: `OTP verification with Mobile Number`
                        });
                    case "6":
                        const application_id = Date.now();
                        const customer_id =
                            String(req.staff.emp_id).slice(0, 4) +
                            Math.floor(10000 + Math.random() * 90000).toString();
                        return res.status(200).json({
                            status_code: "13",
                            status: "onboard-merchant",
                            unique_id: user.unique_id,
                            application_id: user?.application_id || application_id,
                            customer_id: user?.customer_id || customer_id,
                            message:"Onboard Merchant"
                        })
                    case "5":
                      
                    return res.status(200).json({
                        status_code: "14",
                        status: "kyc-pending",
                        unique_id: user.unique_id,
                        message:"Complete E-KYC"
                    })

                    case "4":
                        connection.release();
                        return res.status(200).json({
                            status_code: "15",
                            status: "e-kyc-pending",
                            message: "Onboard Merchant KYC.",
                            unique_id: user.unique_id,
                        });

                    case "3":
                        connection.release();
                        return res.status(200).json({
                            status_code: "17",
                            status: "pending",
                            message: "Activated Merchant Services",
                            unique_id: user.unique_id,
                        });

                    case "2":
                    case "1":
                        connection.release();
                        return res.status(200).json({
                            status_code: "2",
                            status: "failed",
                            message: `Merchant Account is Already Registered`,
                        });

                    case "0":
                        connection.release();
                        return res.status(200).json({
                            status_code: "2",
                            status: "suspended",
                            message: `${user.user_type} wallet  is Suspended`,
                        });
                }
                return res.status(200).json({ data: user });

            
            }
            else
            {  
                 console.log("New User")
                // User not found, generate Unique Id and OTP
                const unique_id = uuid.v4();
                const otp = Math.floor(100000 + Math.random() * 900000).toString();
                const saltedOTP = SALT.concat(otp);
                const hashedOTP = md5(saltedOTP);
                console.log(`While hashing ${otp}`)
                console.log(`While hashing ${hashedOTP}`)
                const dateValue = moment().format('YYYY-MM-DD HH:mm:ss')
                console.log(`otp -> ${otp}`);
                // Insert data into login_data table
                const [value] = await connection.query(
                    "INSERT INTO auths (user_type, unique_id, mobile, status, otp,timestamp) VALUES (?, ?, ?, ?,?,?)",
                    [user_type, unique_id, mobile_number, "7", hashedOTP,  new Date()]
                );
        
                let mobile = mobile_number;
                smsapi("admin", "onboarding_otp", mobile_number, user_type, otp, `3 min`);
                

                connection.release();
                return res.status(200).json({
                    status_code: "12",
                    status: "otp_sent",
                    unique_id: unique_id,
                    message: "OTP Verification Mobile Number",
                });
            
          } 
        }
        else
        {
            return res.status(404).json({
                status_code: "2",
                status: "failed",
                message: "User Type must be csp or merchant",
            });
        }
    } catch (error) {
         console.error(error.message);
        return res.status(500).json({
            status_code: "2",
            status: "failed",
            message: "Internal Server Error",
        });
    }finally {
        connection.release();
    }
});
router.post("/csp-otp-verification", requireStaffLogin, async (req, res) => {
    const connection = await poolPromise2().getConnection();
    try {
        const {
            unique_id,
            otp,
        } = req.body;
        const emp_id = req.staff.emp_id;

        // Check if the user exists with the given unique id
        const [userResult] = await connection.query(
            "SELECT * FROM auths WHERE unique_id = ?",
            [unique_id]
        );

        if (userResult.length > 0)
        {
            const user = userResult[0];


            if (user.status !== "7" && user.status !== "6" )
            {
                connection.release();
                return res.status(200).json({
                    status_code: "2",
                    status: "failed",
                    message: "Merchant already verified.",
                    // data: packageData,
                });
            }


            var response_status_id = ''
            var response_type_id = ''
            var message = ''
            var var_status = ''
   
           
       
            console.log('otp', otp, user.otp)
            console.log(`md5 -> ${md5(SALT.concat(otp))} user.otp -> ${user.otp}`)
            const otpVerifyed =  md5(SALT.concat(otp)) === user.otp

            console.log('otp verified ourSide', otpVerifyed);

            if (!otpVerifyed)
            {
                console.log('our otp is not verifyed')
                connection.release();
                return res.status(200).json({
                    status_code: "2",
                    status: "failed",
                    message: "Invalid OTP",
                });
            } else
            {
                console.log('our otp verifyed')
                const application_id = Date.now();
                const customer_id =
                    String(emp_id).slice(0, 4) +
                    Math.floor(10000 + Math.random() * 90000).toString();
                const auth_time = moment().format('YYYY-MM-DD HH:mm:ss')
                await connection.query(
                    "UPDATE auths SET status = ?  WHERE id = ?",
                    ["6",  user.id]
                );

                connection.release();
                return res.status(200).json({
                    status_code: "13",
                    status: "onboard-merchant",
                    unique_id:user.unique_id,
                    application_id,
                    customer_id,
                    message:"Onboard Merchant"
                });
            
            } 
        }
        else {
            connection.release();
            return res.status(200).json({
                status_code: "2",
                status: "failed",
                message: "User not found",
            });
        }
    } 
    catch (error)
        {
        console.error(error);
        return res.status(500).json({
            status_code: "2",
            status: "failed",
            message: "Internal Server Error",
        });
    } finally {
        connection.release();
    }
});


router.post("/merchant-onboard", requireStaffLogin, async (req, res) => {
    const connection2 = await poolPromise2().getConnection(); // neopartner
    const connection = await poolPromise().getConnection(); // neoadmin
    try
    {
        // const {
        //     unique_id,
        //     name,
        //     email,
        //     gender,
        //     date_of_birth,
        //     pan_number,
        //     aadhar_number,
        //     residential_address,
        //     entity_type,
        //     shop_name,
        //     office_address,
        //     package_id,
        // } = req.body;
        const { unique_id, application_id, customer_id, name, dob, gender, aadhar_number, email, pan_number, residential_address, entity_type, shop_name, package_id } = req.body;
                 
       
        let date_of_birth = dob
        // return res.json({data:"v"})
       
        // JSON.stringify(combinedAddress),
       

        //  const application_id = Date.now();
        // const customer_id =
        //     String(req.staff.emp_id).slice(0, 4) +
        //     Math.floor(10000 + Math.random() * 90000).toString();
        // Insert data into login_data and retailer tables
        //await connection2.beginTransaction();
       
        // Check if the user exists with the given unique id
        const [userResult] = await connection2.query(
            "SELECT * FROM auths WHERE unique_id = ?",
            [unique_id]
        );
       
        console.log(userResult);
        if (userResult.length === 0)
        {
            connection2.release();
            return res.status(200).json({
                status_code: "2",
                status: "failed",
                message: "User not found",
            });
        }
       

        const user = userResult[0];
      
        if (parseInt(user.status) !== 6)
        {
            return res.status(422).json({
                status_code: "2",
                status: "failed",
                message: "Status undefined"
            })
        }

       
        // check for duplicate adhar or pancard 
        //Check if aadhar or pancard exist 
        const [adhar_pan_detail] = await connection2.query(
            "SELECT * FROM merchants WHERE aadhar_number = ? OR pan_number = ?",
            [aadhar_number, pan_number]
        );
        console.log('adhar_pan_detail', adhar_pan_detail);
       
        if (adhar_pan_detail.length !== 0)
        {
            return res.status(422).json({
                status_code: "2",
                status: "failed",
                message: "Pan Number / Aadhar Already Linked to others Wallet",
            });
        }

        
        // console.log(process.env.callEko);
        // check value
        if (process.env.eko_user_onboard === "true")
        {
            try
            {
                const {
                    secretKey,
                    Timestamp: timestamp
                } = await getSecretKeyAndTimeStamp();

                const details = {
                    pan_number,
                    name,
                    email,
                    residential_address,
                    date_of_birth,
                    shop_name,
                    secretKey,
                    mobile:user.mobile,
                    timestamp
                }
                const { requestDetails, details_data, error } = await checkDetails(details);
                if (error)
                {
                    return res.status(422).json({
                        status_code: "2",
                        status: "failed",
                        message: "API is Down"
                    })
                }
                
                if (details_data)
                {
                    try {
                        
                    
                    await connection.query(
                        "INSERT INTO `eko_api_log`(`timestamp`, `api_name`, `request`, `response`) VALUES (?, ?, ?, ?);",
                        [
                            moment().format('YYYY-MM-DD HH:mm:ss'),
        
                            requestDetails.url,
                            JSON.stringify(requestDetails),
                            JSON.stringify(details_data),
                            
                        ]
                    );
                } catch (error) {
                    console.log(error)
                }
                       
                    if (details_data['response_status_id'] !== -1 && details_data['response_type_id']!== 1290)
                    {
                        
                       
                            return res.status(422).json({
                                status_code: "2",
                                status: "failed",
                                message: details_data["message"] 
                            });
                    }
                        
                    
                
                    
                    
                    else
                    {
                        if (details_data["response_type_id"] === 1307)
                        {
                            return res.status(422).json({
                                status_code: "2",
                                status: "failed",
                                message: "Merchant/CSP Already Registered"
                            });
                        }
                        try {
                       
                        await connection2.query("UPDATE auths SET user_code = ? where unique_id = ?",[details_data.data.user_code,unique_id])
                        // return res.status(200).json(details_data);

                        
                        } catch (error) {
                            console.log(error)
                        }
                        try {
                            
                        
                        const result_value = await savevirtualaccount(req,
                            res,
                            unique_id,
                            shop_name,
                            pan_number,
                            residential_address,
                            email,
                            customer_id,
                            application_id,
                            
                            );
                           
                        //     if (result_value?.response?.data?.status === "FAILURE")
                        //     {
                        //         return res.json({
                        //             status_code: "2",
                        //             status: "failed",
                        //             message:`${result_value.response.data.message}`
                        //         })
                        //    }
                       
                        } catch (error)
                        {
                           console.log(error)
                            
                    }
                    

                        // if (result_value.status_code !== "01")
                        // {
                        //     return result_value
                        // }
                        // console.log(`user_type ${user.user_type} package_id ${package_id}`)
                // return res.json({data:"v"})

                        //Check if package exist 
                        const [packageDetailss] = await connection2.query(
                            "SELECT * FROM schemes WHERE userType = ? AND package_id = ?",
                            [user.user_type, package_id]
                        );
                        console.log(user);
                        if (packageDetailss.length === 0)
                        {
                            return res.status(404).json({
                                status_code: "2",
                                status: "failed",
                                message: "Data not found for given  package_id",
                            });
                        }
                        // res.json({ packageDetailss });
                        const [merchants] = await connection2.query(
                            "SELECT * FROM merchants WHERE unique_id = ? ",
                            [user.unique_id]
                        );
                        if (merchants.length > 0)
                        {
                            return res.status(422).json({
                                status_code: "2",
                                status: "failed",
                                message: "Merchant already boarded"
                            });
                        }

                        const auth_time = moment().format('YYYY-MM-DD HH:mm:ss')
                        // Insert into login_data table
                        try {
                            
                       
                        await connection2.query(
                            "UPDATE auths SET status = ? , package_id = ? WHERE id = ?",
                            ["5",package_id, user.id]
                            );
                        } catch (error) {
                           console.log(error) 
                        }
                        const dateValue = moment().format('YYYY-MM-DD HH:mm:ss')
                        // return res.json({
                        //     data:"value"
                        // })
                        // Insert into retailer table
                        try
                        {
                            
                            await connection2.query(
                                "INSERT INTO merchants (unique_id, application_id,customer_id, authorized_person_name,gender,date_of_birth, email,aadhar_number,  pan_number, residential_address, entity_name, entity_type,  status, timestamp) VALUES (?, ?,?, ?, ?, ?, ?, ?, ?, ?,?, ?, ?, ?)",
                                [
                                    unique_id,
                                    application_id,
                                    customer_id,
                                    name,
                                    gender,
                                    date_of_birth,
                                    email,
                                    aadhar_number,
                                    pan_number,
                                    JSON.stringify(residential_address),
                                    shop_name,
                                    entity_type,
                                    
                                    "KYC-Not Submitted",
                                    dateValue
                                ]
                            );
                                
                    
                        }
                        catch (error)
                        {
                            console.log(error);
                        }


                        
                        const packageDetails = packageDetailss[0];
                        const scheme_time = moment().format('YYYY-MM-DD HH:mm:ss')
                        // Insert into schemesummarys table

                        function generateYearMonth() {
                            const now = new Date();
                            const year = now.getFullYear();
                            const month = (now.getMonth() + 1).toString().padStart(2, "0");
                            return `${year}${month}`;
                        }
                        const yearMonth = generateYearMonth();
                        let reference_id = yearMonth + Number(7654321);
  
                        // try {
                            
                        
                        // await connection2.query(
                        //     "INSERT INTO schemesummarys (tran_at, order_id, unique_id, customer_id, packid, packname, price, gst, total, status, validity) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                        //     [
                        //         new Date(),
                        //         reference_id,
                        //         user.unique_id,
                        //         customer_id,
                        //         package_id,
                        //         packageDetails.packname,
                        //         packageDetails.price,
                        //         packageDetails.gst,
                        //         packageDetails.total,
                        //         "Pending",
                        //         packageDetails.duration,
                            
                        //     ]
                        //     );
                        // } catch (error) {
                            
                        // }
                        console.log(`packages_id ${package_id}`)
                        const [serviceData] = await connection2.execute(
                            "SELECT * FROM service_with_packages WHERE packages_id = ?",
                            [package_id]
                        );

                        if (!serviceData.length)
                        {
                            connection2.release();
                            return res.status(500).json({
                                success: false,
                                message: "No services found for this package",
                            });
                        }

                        const userData = serviceData.map((item) => [
                            user.unique_id,
                            item.packages_id,
                            item.services_id,
                            item.status,
                            item.packages_name,
                            item.services_name,
                            new Date(), // createdAt
                            new Date() // updatedAt
                        ]);
                        try {
                            await connection2.query(
                                "INSERT INTO user_services (unique_id, packages_id, service_id, status, `packages_name`, `service_name`,createdAt,updatedAt) VALUES ?",
                                [userData]
                            ); 
                        } catch (error) {
                            console.log(error);
                        }
                      
                        
                            
    
    
                        const wallet_time = moment().format('YYYY-MM-DD HH:mm:ss')
                        // Insert into wallet table
                        try {
                            await connection2.query(
                                "INSERT INTO wallets (user_type, unique_id, wallet, hold, unsettle, status,createdAt,updatedAt) VALUES (?, ?, ?, ?, ?, ?,?,?)",
                                [user.user_type, user.unique_id, 0, 0, 0, "Enable", wallet_time, wallet_time]
                            );
                        } catch (error) {
                            console.log(error);
                        }
                       

                        await connection2.commit();
                        connection2.release();

                        return res.status(200).json({
                            status_code: "22",
                            status: "success",
                            unique_id,
                            message: "Merchant successfully onboarded",
                        });
                    }
                }
                else
                {
                    return res.status(500).json({
                        status_code: "2",
                        status: "failed",
                        message: "Invalid Data",
                    });
                }

               
            } catch (err)
            {
                return res.status(500).json({
                    status_code: "2",
                    status: "failed",
                    message: "Internal Server Error",
                });
            }

        }
        else
        {
                        
                      
                        try {
                            
                        
                        const result_value = await savevirtualaccount(req,
                            res,
                            unique_id,
                            shop_name,
                            pan_number,
                            residential_address,
                            email,
                            customer_id,
                            application_id,
                            
                            );
                           
                        //     if (result_value?.response?.data?.status === "FAILURE")
                        //     {
                        //         return res.json({
                        //             status_code: "2",
                        //             status: "failed",
                        //             message:`${result_value.response.data.message}`
                        //         })
                        //    }
                       
                        } catch (error)
                        {
                           console.log(error)
                            
                    }
                    

                        // if (result_value.status_code !== "01")
                        // {
                        //     return result_value
                        // }
                        // console.log(`user_type ${user.user_type} package_id ${package_id}`)
                // return res.json({data:"v"})

                        //Check if package exist 
                        const [packageDetailss] = await connection2.query(
                            "SELECT * FROM schemes WHERE userType = ? AND package_id = ?",
                            [user.user_type, package_id]
                        );
                        console.log(user);
                        if (packageDetailss.length === 0)
                        {
                            return res.status(404).json({
                                status_code: "2",
                                status: "failed",
                                message: "Data not found for given  package_id",
                            });
            }
            
                        // res.json({ packageDetailss });
                        const [merchants] = await connection2.query(
                            "SELECT * FROM merchants WHERE unique_id = ? ",
                            [user.unique_id]
                        );
                        if (merchants.length > 0)
                        {
                            return res.status(422).json({
                                status_code: "2",
                                status: "failed",
                                message: "Merchant already boarded"
                            });
                        }

                        const auth_time = moment().format('YYYY-MM-DD HH:mm:ss')
                        // Insert into login_data table
                        try {
                            
                       
                        await connection2.query(
                            "UPDATE auths SET status = ? , package_id = ? WHERE id = ?",
                            ["5",package_id, user.id]
                            );
                        } catch (error) {
                           console.log(error) 
            }
            
                        const dateValue = moment().format('YYYY-MM-DD HH:mm:ss')
                        // return res.json({
                        //     data:"value"
                        // })
                        // Insert into retailer table
                        try
                        {
                            
                            await connection2.query(
                                "INSERT INTO merchants (unique_id, application_id,customer_id, authorized_person_name,gender,date_of_birth, email,aadhar_number,  pan_number, residential_address, entity_name, entity_type,  status, timestamp) VALUES (?, ?,?, ?, ?, ?, ?, ?, ?, ?,?, ?, ?, ?)",
                                [
                                    unique_id,
                                    application_id,
                                    customer_id,
                                    name,
                                    gender,
                                    date_of_birth,
                                    email,
                                    aadhar_number,
                                    pan_number,
                                    JSON.stringify(residential_address),
                                    shop_name,
                                    entity_type,
                                    
                                    "KYC-Not Submitted",
                                    dateValue
                                ]
                            );
                                
                    
                        }
                        catch (error)
                        {
                            console.log(error);
                        }


                        
                        const packageDetails = packageDetailss[0];
                        const scheme_time = moment().format('YYYY-MM-DD HH:mm:ss')
                        // Insert into schemesummarys table

                        function generateYearMonth() {
                            const now = new Date();
                            const year = now.getFullYear();
                            const month = (now.getMonth() + 1).toString().padStart(2, "0");
                            return `${year}${month}`;
                        }
                        const yearMonth = generateYearMonth();
                        let reference_id = yearMonth + Number(7654321);
  
                        // try {
                            
                        
                        // await connection2.query(
                        //     "INSERT INTO schemesummarys (tran_at, order_id, unique_id, customer_id, packid, packname, price, gst, total, status, validity) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                        //     [
                        //         new Date(),
                        //         reference_id,
                        //         user.unique_id,
                        //         customer_id,
                        //         package_id,
                        //         packageDetails.packname,
                        //         packageDetails.price,
                        //         packageDetails.gst,
                        //         packageDetails.total,
                        //         "Pending",
                        //         packageDetails.duration,
                            
                        //     ]
                        //     );
                        // } catch (error) {
                            
                        // }
                        console.log(`packages_id ${package_id}`)
                        const [serviceData] = await connection2.execute(
                            "SELECT * FROM service_with_packages WHERE packages_id = ?",
                            [package_id]
                        );

                        if (!serviceData.length)
                        {
                            connection2.release();
                            return res.status(500).json({
                                success: false,
                                message: "No services found for this package",
                            });
                        }

                        const userData = serviceData.map((item) => [
                            user.unique_id,
                            item.packages_id,
                            item.services_id,
                            item.status,
                            item.packages_name,
                            item.services_name,
                            new Date(), // createdAt
                            new Date() // updatedAt
                        ]);
                        try {
                            await connection2.query(
                                "INSERT INTO user_services (unique_id, packages_id, service_id, status, `packages_name`, `service_name`,createdAt,updatedAt) VALUES ?",
                                [userData]
                            ); 
                        } catch (error) {
                            console.log(error);
                        }
                      
                        
                            
    
    
                        const wallet_time = moment().format('YYYY-MM-DD HH:mm:ss')
                        // Insert into wallet table
                        try {
                            await connection2.query(
                                "INSERT INTO wallets (user_type, unique_id, wallet, hold, unsettle, status,createdAt,updatedAt) VALUES (?, ?, ?, ?, ?, ?,?,?)",
                                [user.user_type, user.unique_id, 0, 0, 0, "Enable", wallet_time, wallet_time]
                            );
                        } catch (error) {
                            console.log(error);
                        }
                       

                        await connection2.commit();
                        connection2.release();

                        return res.status(200).json({
                            status_code: "22",
                            status: "success",
                            unique_id,
                            message: "Merchant successfully onboarded",
                        });
                    }
    }
 catch (error) {
        console.error(error);
        await connection2.rollback();
        connection2.release();
        return res.status(500).json({
            status_code: "2",
            status: "failed",
            message: "Internal Server Error",
        });
    }
});

router.post("/onboard-merchant-kyc", requireStaffLogin,
    upload2.fields([
        {
            name: "pan_front",
            maxCount: 1
        },
        {
            name: "aadhar_front",
            maxCount: 1
        },
        {
            name: "aadhar_back",
            maxCount: 1
        },
         {
            name: "shop_photo",
            maxCount: 1
        },
        {
            name: "passport_photo",
            maxCount: 1
        },
    ]),
    async (req, res) => {
        console.log('coming inside');
        const connection = await poolPromise2().getConnection();
        const connections = await poolPromise().getConnection();

        try {
            const {
                unique_id,device_number,model_name,office_address
            } = req.body;
            if(!unique_id){
                return res.send({statuscode:2, status:'failed', message:'please send unique_id in body along with other documents'})
            }

            // Check if the user exists with the given unique id
            const [userResult] = await connection.query(
                "SELECT * FROM auths WHERE unique_id = ?",
                [unique_id]
            );
            console.log(userResult);
            if (userResult.length === 0) {
                connection.release();
                return res.status(200).json({
                    status_code: "2",
                    status: "failed",
                    message: "User not found",
                });
            }
            if (userResult[0].status != 5) {
                connection.release();
                return res.status(200).json({
                    status_code: "2",
                    status: "failed",
                    message: "Status not defined",
                });
            }
            const [service_result] = await connection.query(
                "SELECT * FROM user_services WHERE service_id = ? and unique_id = ?",
                [38, userResult[0].unique_id]
            );
            if (service_result.length === 0) {
                connection.release();
                return res.status(200).json({
                    status_code: "2",
                    status: "failed",
                    message: "User Service not found",
                });
            }
            // return res.json({u:service_result[0].status,d:process.env.eko_user_onboard })
            if (service_result[0].status === "enable" )
            {
                if (!(model_name !== null && device_number !== null))
                {
                    return res.status(200).json({
                        status_code: "2",
                        status: "failed",
                        message: "Model Name and Device Name is missing",
                    });
                }
                else
                {
                              
                    if (!req.files)
                    {
                        connection.release();
                        return res.status(422).json({
                            status_code: "2",
                            status: "failed",
                            message: "No files found",
                        });
                    }
                    const user = userResult[0];
                    console.log('req files', req.files)
                    // Check if files were uploaded
            
                    if (!req.files || Object.keys(req.files).length === 0)
                    {
                        return res.status(400).send({ statuscode: 2, status: 'failed', message: 'No files were uploaded. send photo ,pan_front ,aadhar_front ,aadhar_back ,shop_photo' });
                    }
            
                    const requiredFiles = ['passport_photo', 'pan_front', 'aadhar_front', 'aadhar_back', 'shop_photo'];
                    const missingFiles = requiredFiles.filter(file => !req.files[file]);
            
                    if (missingFiles.length > 0)
                    {
                        return res.status(400).send({ statuscode: 2, status: 'failed', message: `Missing files: ${missingFiles.join(', ')}` });
                    }
            
            
            
            
                    const panFrontPath = req.files["pan_front"][0].filename;
                    const passportphoto = req.files["passport_photo"][0].filename;
                    const aadharFrontPath = req.files["aadhar_front"][0].filename;
                    const aadharBackPath = req.files["aadhar_back"][0].filename;
                    const shop_photo = req.files["shop_photo"][0].filename;
            
                    const merchant_time = moment().format('YYYY-MM-DD HH:mm:ss')
                    // return res.json({user})
                    // if()
                    if (process.env.eko_user_onboard === "true")
                    {
                        
                    
                        const result = await handleFileUpload(req, res, {
                            device_number,
                            model_name,
                            office_address,
                            user_code: userResult[0].user_code,
                            residential_address: userResult[0].residential_address,
                        });
                    
                        try
                        {
                        
                            // return res.json({result})
                            await connections.query(
                                "INSERT INTO `eko_api_log`(`timestamp`, `api_name`, `request`, `response`) VALUES (?, ?, ?, ?);",
                                [
                                    moment().format('YYYY-MM-DD HH:mm:ss'),
    
                                    result.config.url,
                                    JSON.stringify(result.config),
                                    JSON.stringify(result.data),
                        
                                ]
                            );
                        } catch (error)
                        {
                            console.log(error)
                        }
                        if (result.data.response_status_id !== 0)
                        {
                            return res.json({
                                status_code: "2",
                                status: "failed",
                                message: result.data.message
                            })
                        }
                        if (result.data.response_type_id === 1259)
                        {

                            try
                            {
                            
                        
                                await connection.query(
                                    "UPDATE merchants SET photo = ?, shop_photo = ?, pan_front = ?, aadhar_front = ?, aadhar_back = ?, status = ? , office_address = ? WHERE unique_id = ?",
                                    [
                                        passportphoto,
                                        shop_photo,
                                        panFrontPath,
                                        aadharFrontPath,
                                        aadharBackPath,
                                        "KYC-Submit",
                                        office_address,
                                        user.unique_id,
                                    ]
                                );
                            }
                            catch (error)
                            {
                                console.log(error);
                            }
                        
                            const auth_time = moment().format('YYYY-MM-DD HH:mm:ss')
                            // Update status code in login_data table
                                            
                            const map_time = moment().format('YYYY-MM-DD HH:mm:ss')
                            try
                            {
                            
                                await connection.query(
                                    "INSERT INTO mappings (unique_id, services_type,time_stamp, distributor_id, created_by, asm_id,device_number,model_name) VALUES (?,?, ?, ?, ?, ?,?,?) ",
                                    [unique_id, 38, map_time, user.unique_id, req.staff.emp_id, req.staff.emp_id, device_number, model_name]
                                );
                            }
                            catch (error)
                            {
                                console.log(error)
                            }
                            await connection.query(
                                "UPDATE auths SET status = ? WHERE unique_id = ?",
                                ["4", unique_id]
                            );
                            try
                            {
                                    
                                    
                                        
                                const [merchantResult] = await connection.query("SELECT * FROM merchants WHERE unique_id = ?", [user.unique_id]);
                                        
                                const [userResult] = await connection.query("SELECT * FROM auths where unique_id =  ?", [merchantResult[0].unique_id])
                                    
                                const result_value = await getAadharOtp(merchantResult[0].aadhar_number, userResult[0].user_code);
                                try
                                {
                                                        
                                                    
                                    await connection.query(
                                        "INSERT INTO `eko_api_log`(`timestamp`, `api_name`, `request`, `response`) VALUES (?, ?, ?, ?);",
                                        [
                                            moment().format('YYYY-MM-DD HH:mm:ss'),
                                
                                            result_value.config.url,
                                            JSON.stringify(result_value.config),
                                            JSON.stringify(result_value.data),
                                                    
                                        ]
                                    );
                                } catch (error)
                                {
                                    console.log(error)
                                }
                                if (result_value && result_value.data.response_status_id !== 0)
                                {
                                    return res.json({
                                        status_code: "2",
                                        status: "failed",
                                        message: result_value.data.data.reason || "Otp request not sent"
                                    })
                                }
                                try
                                {
                                    await connection.query("UPDATE mappings SET otp_ref_id = ? , reference_tid = ?", [result_value.data.data.otp_ref_id, result_value.data.data.reference_tid])
                                } catch (error)
                                {
                                    console.log(error)
                                }
                                return res.json({
                                    status_code: "16",
                                    status: "otp-request-success",
                                    reference_tid: result_value.data.data.reference_tid,
                                    otp_reference_id: result_value.data.data.otp_ref_id
                                })
                                       
                            }
                            catch (error)
                            {
                                return res.json({
                                    status_code: "2",
                                    status: "failed",
                                    message: "Internal Server Error"
                                })
                            }
                            connection.release();
                        
                            return res.status(200).json({
                                status_code: "15",
                                status: "e-kyc-pending",
                                unique_id,
                                message: result.data.message,
                            });
                        }
                        else
                        {
                            return res.json({
                                status_code: "2",
                                status: "failed",
                                message: result.data.message
                            })
                        }
                    }
                    else
            {
                          
            if (!req.files) {
                connection.release();
                return res.status(422).json({
                    status_code: "2",
                    status: "failed",
                    message: "No files found",
                });
            }

            const user = userResult[0];
                // Check if files were uploaded

            if (!req.files || Object.keys(req.files).length === 0) {
                return res.status(400).send({ statuscode : 2, status: 'failed', message: 'No files were uploaded. send photo ,pan_front ,aadhar_front ,aadhar_back ,shop_photo'});
            }

            const requiredFiles = ['passport_photo','pan_front', 'aadhar_front', 'aadhar_back','shop_photo'];
            const missingFiles = requiredFiles.filter(file => !req.files[file]);
        
            if (missingFiles.length > 0) {
                return res.status(400).send({ statuscode : 2, status: 'failed', message: `Missing files: ${missingFiles.join(', ')}`});
            }

       

            const panFrontPath = req.files["pan_front"][0].filename;
            const aadharFrontPath = req.files["aadhar_front"][0].filename;
            const aadharBackPath = req.files["aadhar_back"][0].filename;
           
            const shop_photo = req.files["shop_photo"][0].filename;

                const merchant_time = moment().format('YYYY-MM-DD HH:mm:ss')
               
          await connection.query(
    "UPDATE merchants SET photo = ?, shop_photo = ?, pan_front = ?, aadhar_front = ?, aadhar_back = ?, status = ?, office_address = ? WHERE unique_id = ?",
    [
        panFrontPath,
         shop_photo,

        panFrontPath,
        aadharFrontPath,
        aadharBackPath,
        "KYC-Pending",
        office_address,
        user.unique_id,
    ]
);

            const auth_time = moment().format('YYYY-MM-DD HH:mm:ss')
            // Update status code in login_data table
            await connection.query(
                "UPDATE auths SET status = ? WHERE unique_id = ?",
                ["3",unique_id]
            );
           
            connection.release();

            return res.status(200).json({
                status_code: "17",
                status: "Pending",
                unique_id,
                message: "Activated Merchant Services",
            });
            }
                    
                }
            }
            else
            {
                          
            if (!req.files) {
                connection.release();
                return res.status(422).json({
                    status_code: "2",
                    status: "failed",
                    message: "No files found",
                });
            }

            const user = userResult[0];
                // Check if files were uploaded

            if (!req.files || Object.keys(req.files).length === 0) {
                return res.status(400).send({ statuscode : 2, status: 'failed', message: 'No files were uploaded. send photo ,pan_front ,aadhar_front ,aadhar_back ,shop_photo'});
            }

            const requiredFiles = ['passport_photo','pan_front', 'aadhar_front', 'aadhar_back','shop_photo'];
            const missingFiles = requiredFiles.filter(file => !req.files[file]);
        
            if (missingFiles.length > 0) {
                return res.status(400).send({ statuscode : 2, status: 'failed', message: `Missing files: ${missingFiles.join(', ')}`});
            }

       

            const panFrontPath = req.files["pan_front"][0].filename;
            const aadharFrontPath = req.files["aadhar_front"][0].filename;
            const aadharBackPath = req.files["aadhar_back"][0].filename;
           
            const shop_photo = req.files["shop_photo"][0].filename;

                const merchant_time = moment().format('YYYY-MM-DD HH:mm:ss')
               
          await connection.query(
    "UPDATE merchants SET photo = ?, shop_photo = ?, pan_front = ?, aadhar_front = ?, aadhar_back = ?, status = ?, office_address = ? WHERE unique_id = ?",
    [
        panFrontPath,
         shop_photo,

        panFrontPath,
        aadharFrontPath,
        aadharBackPath,
        "KYC-Pending",
        office_address,
        user.unique_id,
    ]
);

            const auth_time = moment().format('YYYY-MM-DD HH:mm:ss')
            // Update status code in login_data table
            await connection.query(
                "UPDATE auths SET status = ? WHERE unique_id = ?",
                ["3",unique_id]
            );
           
            connection.release();

            return res.status(200).json({
                status_code: "17",
                status: "Pending",
                unique_id,
                message: "Activated Merchant Services",
            });
            }
            
        } catch (error) {
            console.error(error);
            connection.release();
            return res.status(500).json({
                status_code: "2",
                status: "failed",
                message: "Internal Server Error",
            });
        }
    }
);

router.post("/get-aadhar-otp", requireStaffLogin, async (req, res) => {
    const connection = await poolPromise2().getConnection();
    const connections = await poolPromise().getConnection();

    try
    {
    
    
        const { aadhar_number } = req.body;
        const [merchantResult] = await connection.query("SELECT * FROM merchants WHERE aadhar_number = ?", [aadhar_number]);
        if (merchantResult.length === 0)
        {
            return res.json({
                status_code: "2",
                status: "failed",
                message:"Merchant not Found"
            })
        }
        const [userResult] = await connection.query("SELECT * FROM auths where unique_id =  ?",[merchantResult[0].unique_id])
        // return res.json({userResult})
        const result_value = await getAadharOtp(aadhar_number, userResult[0].user_code);
        try {
                        
                    
            await connections.query(
                "INSERT INTO `eko_api_log`(`timestamp`, `api_name`, `request`, `response`) VALUES (?, ?, ?, ?);",
                [
                    moment().format('YYYY-MM-DD HH:mm:ss'),

                    result_value.config.url,
                    JSON.stringify(result_value.config),
                    JSON.stringify(result_value.data),
                    
                ]
            );
        } catch (error) {
            console.log(error)
        }
        if (result_value && result_value.data.response_status_id !== 0)
        {
            return res.json({
                status_code: "2",
                status: "failed",
                message: result_value.data.data.reason  || "Otp request not sent"
            })
        }
        try
        {
         await connection.query("UPDATE mappings SET otp_ref_id = ? , reference_tid = ?",[result_value.data.data.otp_ref_id,result_value.data.data.reference_tid])   
        } catch (error)
        {
            console.log(error)
        }
        return res.json({
            status_code: "16",
            status: "otp-request-success",
            reference_tid: result_value.data.data.reference_tid,
            otp_reference_id:result_value.data.data.otp_ref_id
        })
       
    }
    catch (error)
    {
        return res.json({
            status_code: "2",
            status: "failed",
            message:"Internal Server Error"
        })
    }
    
    
})
router.get("/resend-otp/:unique_id", requireStaffLogin, async (req, res) => {
    const connection = await poolPromise2().getConnection();
    const connections = await poolPromise().getConnection();
    const unique_id = req.params.unique_id;
    try
    {
    
    
        const { aadhar_number } = req.body;
        const [merchantResult] = await connection.query("SELECT * FROM merchants WHERE unique_id = ?", [unique_id]);
        if (merchantResult.length === 0)
        {
            return res.json({
                status_code: "2",
                status: "failed",
                message:"Merchant not Found"
            })
        }
        const [userResult] = await connection.query("SELECT * FROM auths where unique_id =  ?",[merchantResult[0].unique_id])
        const result_value = await getAadharOtp(merchantResult[0].aadhar_number, userResult[0].user_code);
        try {
            
            
            await connections.query(
                "INSERT INTO `eko_api_log`(`timestamp`, `api_name`, `request`, `response`) VALUES (?, ?, ?, ?);",
                [
                    moment().format('YYYY-MM-DD HH:mm:ss'),
                    
                    result_value.config.url,
                    JSON.stringify(result_value.config),
                    JSON.stringify(result_value.data),
                    
                ]
                );
                return res.json({result_value})
            } catch (error) {
                console.log(error)
            }
        if (result_value && result_value.data.response_status_id !== 0)
        {
            return res.json({
                status_code: "2",
                status: "failed",
                message: result_value.data.data.reason  || "Otp request not sent"
            })
        }
        try
        {
         await connection.query("UPDATE mappings SET otp_ref_id = ? , reference_tid = ?",[result_value.data.data.otp_ref_id,result_value.data.data.reference_tid])   
        } catch (error)
        {
            console.log(error)
        }
        return res.json({
            status_code: "16",
            status: "otp-request-success",
            reference_tid: result_value.data.data.reference_tid,
            otp_reference_id:result_value.data.data.otp_ref_id
        })
       
    }
    catch (error)
    {
        return res.json({
            status_code: "2",
            status: "failed",
            message:"Internal Server Error"
        })
    }
    
    
})
router.post("/verify-otp", requireStaffLogin, async (req, res) => {
    const connection = await poolPromise2().getConnection();
    const connections = await poolPromise().getConnection();

    try
    {
        
        
        const { unique_id, otp } = req.body;
        
        const [mappingResult] = await connection.query("SELECT * FROM mappings WHERE unique_id = ?", [unique_id])
        const [userResult] = await connection.query("SELECT * FROM auths WHERE unique_id = ?", [unique_id])

        if (mappingResult.length === 0)
        {
            return res.json({
                status_code: "2",
                status: "failed",
                message:"User not Found"
            })
        }
        const [merchant_value] = await connection.query("SELECT * FROM merchants WHERE unique_id = ? ", [unique_id]);
        if (merchant_value.length === 0)
        {
            return res.json({
                status_code: "2",
                status: "failed",
                message:"Merchant not Found"
            })
        }
        const result_value = await verifyAadharOtp(otp, mappingResult[0].otp_ref_id, mappingResult[0].reference_tid,merchant_value[0].aadhar_number,userResult[0].user_code);
        try {
                    
            await connections.query(
                "INSERT INTO `eko_api_log`(`timestamp`, `api_name`, `request`, `response`) VALUES (?, ?, ?, ?);",
                [
                    moment().format('YYYY-MM-DD HH:mm:ss'),

                    result_value.config.url,
                    JSON.stringify(result_value.config),
                    JSON.stringify(result_value.data),
                    
                ]
            );
        } catch (error) {
            console.log(error)
        }

        console.log(`result_value ${JSON.stringify(result_value)}`)
        console.log(`data  ${JSON.stringify(result_value.data)}`)
        console.log(`reponse_status_id  ${result_value.data.response_status_id}`)
        if (result_value && result_value.data.response_status_id !== 0)
        {
            return res.json({
                status_code: "2",
                status: "failed",
                message: result_value.data.message  || "Otp request not sent"
            })
        }
        if (result_value.data.response_status_id === 0)
        {
            

            await connection.query(
                "UPDATE auths SET status = ? WHERE unique_id = ?",
                ["3",unique_id]
            );

            return res.json({
                status_code: "17",
                status: "pending",
                unique_id,
                message:"Activate Merchant Services"
            })
            }
       
       
    }
    catch (error)
    {
        console.log(error)
        return res.json({
            status_code: "2",
            status: "failed",
            message:"Internal Server Error"
        })
    }
})
router.post("/activated-services", requireStaffLogin, async (req, res) => {
    const connection = await poolPromise2().getConnection();

    try {
        const {
            unique_id,
            mode_of_payment,
        } =
        req.body;

        const emp_id = req.staff.emp_id;

         // Simple validation
        const missingFields = [];
        if (!unique_id) missingFields.push('unique_id');
        // if (!model_name) missingFields.push('model_name');
        // if (!device_number) missingFields.push('device_number');
        if (!mode_of_payment) missingFields.push('mode_of_payment');

        if (missingFields.length > 0) {
            return res.status(400).send({ statuscode : 2, status: 'failed', message: `Mandatory fields are missing or empty: ${missingFields.join(', ')}`});
        }
    

        // Check if the user exists with the given unique id
        const [userResult] = await connection.query(
            "SELECT * FROM auths WHERE unique_id = ? ",
            [unique_id]
        );
        if (userResult.length === 0) {
            connection.release();
            return res.status(200).json({
                status_code: "2",
                status: "failed",
                message: "User not found",
            });
        }
        const user = userResult[0];

        if(user.status == 2){
            return res.send({statuscode : 2, status:'failed', message: 'Service Already Activated'})
        }
        
        if(user.status != 3){
            return res.send({statuscode:1, status:'failed', message:'user status is not 3 '})
        }

        // Check if service_id 41 is enabled for the user
        // const [userServices] = await connection.query(
        //     "SELECT * FROM user_services WHERE  service_id = 41 AND status = ?",
        //     [ "Enable"]
        // );
            
        // if (userServices.length === 0) {
        //     // Insert data in mapping table
        //     const map_time = moment().format('YYYY-MM-DD HH:mm:ss')
        //     await connection.query(
        //         "INSERT INTO mappings (unique_id, services_type,time_stamp, application_id, created_by, asm_id,createdAt,updatedAt) VALUES (?,?, ?, ?, ?, ?,?,?) ",
        //         [user.unique_id, "None", map_time,user.unique_id, emp_id, emp_id,map_time,map_time]
        //     );
        // } else {
        //     // Insert data in mapping table
        //     const map_time = moment().format('YYYY-MM-DD HH:mm:ss')

        //     if (userServices.length > 0 && (!model_name || !device_number)) {
        //         connection.release();
        //         return res.status(200).json({
        //             status_code: "2",
        //             status: "failed",
        //             message: "Model Name and Device Number are missing.",
        //         });
        //     }

        //     await connection.query(
        //         "INSERT INTO mappings (unique_id, services_type, application_id, created_by, asm_id, model_name, device_number,createdAt,updatedAt) VALUES (?, ?, ?, ?, ?, ?,?,?,?) ",
        //         [
        //             user.unique_id,
        //             "AePS",
        //             user.unique_id,
        //             emp_id,
        //             emp_id,
        //             model_name,
        //             device_number,
        //             map_time,
        //             map_time
        //         ]
        //     );
        // }

        // Check if model_name and device_number are provided when the service is enabled
        // const auth_time = moment().format('YYYY-MM-DD HH:mm:ss')
        // // Update status code in login_data table
        // await connection.query(
        //     "UPDATE auths SET status = ? WHERE unique_id = ?",
        //     ["2", auth_time,unique_id]
        // );

        const [scheme] = await connection.query(
            "SELECT * FROM schemes WHERE package_id = ?",
            [user.package_id]
        );

           
        const currentTimestamp = Date.now();
        const currentDate = new Date(currentTimestamp);
        const expiryDays = scheme[0].duration;
        const expiryTimestamp = currentTimestamp + expiryDays * 24 * 60 * 60 * 1000;
        const expiryDate = new Date(expiryTimestamp);

        const activedate = currentDate.toISOString().substring(0, 10);
        const expiredate = expiryDate.toISOString().substring(0, 10);

        if (mode_of_payment === "Cash" || mode_of_payment === "cash")
        {
            // Update status, active date, expire date in login_data table
            // (Only if mode of payment is Cash)
            await connection.query(
                "UPDATE schemesummarys SET status = ?, activedate = ?, expiredate = ? WHERE unique_id = ?",
                ["Success", activedate, expiredate, user.unique_id]
            );

            await connection.query(
                "UPDATE auths SET status = ?, package_expiry = ? WHERE unique_id = ?",
                ["2", expiredate, unique_id]
            );
            // Update status, active date, expire date in scheme summary table
          
        
            const [merchantResult] = await connection.query(
                "SELECT * FROM merchants WHERE unique_id = ?",
                [unique_id]
            );
    
            const merchantValue = merchantResult[0];
            // smsapi("admin", "otp_send", mobile_number, otp, `3 min`);
            // onboarding_code

            smsapi("admin", "onboard-alert", user.mobile, merchantValue['authorized_person_name'], "Merchant");

            connection.release();

            return res.status(200).json({
                status_code: "1",
                status: "success",
                unique_id,
                message: "Merchant Account Activated successfully.",
            });
        }
    } catch (error) {
        console.error(error);
        connection.release();
        return res.status(500).json({
            status_code: "2",
            status: "failed",
            message: "Internal Server Error",
        });
    }
});


router.post("/activated-services_", requireStaffLogin, async (req, res) => {
    const connection = await poolPromise2().getConnection();
    let connection2 = null;
    // return res.json({data:"v"})
    try {
        const {
            unique_id,
            mode_of_payment,
        } = req.body;

        const emp_id = req.staff.emp_id;

        // Simple validation
        const missingFields = [];
        if (!unique_id) missingFields.push('unique_id');
        if (!mode_of_payment) missingFields.push('mode_of_payment');

        if (missingFields.length > 0) {
            connection.release();
            return res.status(400).send({ statuscode: 2, status: 'failed', message: `Mandatory fields are missing or empty: ${missingFields.join(', ')}`});
        }

        // Check user and activation conditions
        const [userResult] = await connection.query("SELECT * FROM auths WHERE unique_id = ?", [unique_id]);
        if (userResult.length === 0) {
            connection.release();
            return res.status(200).json({status_code: "2", status: "failed", message: "User not found"});
        }
        // return res.json({userResult})
        const user = userResult[0];
        if (Number(user.status) === 2) {
            connection.release();
            return res.send({statuscode: 2, status:'failed', message: 'Service Already Activated'});
        }

        if (Number(user.status) !== 3) {
            connection.release();
            return res.send({statuscode: 1, status:'failed', message: 'User status is not 3'});
        }

        // Handling QR mode of payment
        if (mode_of_payment.toLowerCase() === "qr") {
            connection2 = await poolPromise2().getConnection(); // Second connection
            const amount = 5; // Assuming an amount; you might want to get this from somewhere
            const message = "Activation Fee";

            const [[services_manager]] = await connection2.execute("SELECT * FROM services_managers WHERE category_id = 10");
            // return res.json({services_manager})
        //    return res.json({c:services_manager.category_id, id:user.package_id, unique_id})
            const [[users_services]] = await connection2.execute("SELECT * FROM user_services WHERE service_id = ? AND packages_id = ? AND unique_id = ?", [services_manager.category_id, user.package_id, unique_id]);
            if (!users_services || users_services.status === "Disable") {
                connection.release();
                if (connection2) connection2.release();
                return res.status(404).json({ message: "Services not enabled." });
            }
            // return res.json({users_services})

            function generateYearMonth() {
                const now = new Date();
                const year = now.getFullYear();
                const month = (now.getMonth() + 1).toString().padStart(2, "0");
                return `${year}${month}`;
            }

            const yearMonth = generateYearMonth();
            const [[get_reff_id]] = await connection2.query("SELECT MAX(`reference_id`) as max_reference_id FROM upi_collection");
            let reference_id = yearMonth + (get_reff_id?.max_reference_id ? Number(get_reff_id.max_reference_id) + 3 : 7654321);
            // return res.json({reference_id})

            const prover_name = "decentro";
            const [headers_key] = await connection2.execute("SELECT * FROM vender_key WHERE prover_name = ?", [prover_name]);
            const apiurl = `${headers_key[0].bash_url}/v2/payments/upi/link`;
            const headers = {
                client_id: headers_key[0].value,
                client_secret: headers_key[0].value_1,
                module_secret: headers_key[0].value_3,
                provider_secret: headers_key[0].value_4,
                "Content-Type": "application/json",
            };
            // return res.json({headers_key})
            const [virtual_account] = await connection2.execute(
                "SELECT * FROM virtual_account WHERE unique_id = ?",
                [unique_id]
            );
            // // return res.json({virtual_account})

            console.log(`process.env.DEFAULT_VA ${process.env.DEFAULT_VA}`)
   
            const requestBody = {
                timestamp: Date.now(),
                unique_id:unique_id,
                reference_id: `${Date.now()}`, // Simple generation, might need a better one
                payee_account:  process.env.DEFAULT_VA, // Adjust based on your account settings
                amount: Number(amount),
                purpose_message: 'New Activation',
                generate_qr: 1,
                expiry_time: 5,
                customized_qr_with_logo: 0,
                generate_uri: 1,
            };
            // return res.json({requestBody})
            // return res.json({ headers_key,requestBody })
            
       
            try {
            //     const data = await axios.post(apiurl, requestBody, { headers });
            //     // return res.json({data})
            //     var response = data.data;
            // // return res.json(response)
            //     var requestSuccess = {
            //       headers,
            //       apiurl: apiurl,
            //       requestBody: requestBody,
            //     };
            //     // return res.json({requestSuccess})
            //     console.log(`process.env.DEFAULT_VA ${process.env.DEFAULT_VA}`)
            //     const body_request = {  
            //       unique_id: unique_id,
            //       reference_id: reference_id,
            //       payee_account: process.env.DEFAULT_VA,
            //       status: "Pending",
            //       message: message,
            //       timestamp: Date.now(),
            //       amount: Number(amount),
            //       request: JSON.stringify(requestSuccess),
            //       response: JSON.stringify(response),
            //       tnxid: data.data.decentroTxnId,
            //     };
            //     // return res.json({body_request})
                try
                {
                    
            //         try {
            //             const [upi_collection] = await connection2.query(
            //                 "INSERT INTO upi_collection SET ?",
            //                 [body_request]
            //             );
            //         } catch (error) {
            //             console.log(error)
            //         }
                
                   
                    const yearMonth = generateYearMonth();
                    let order_id = yearMonth + Number(7654321);
                    const [package_result] = await connection2.query("SELECT * FROM schemes WHERE package_id = ? ", [userResult[0].package_id])
                    // return res.json({package_result})
                    const scheme_data = {  
                        tran_at:  moment().format('YYYY-MM-DD HH:mm:ss'),
                        order_id:order_id,
                        order_by:req.staff.emp_id,
                        unique_id: unique_id,
                        packid: userResult[0].package_id,
                        packname:package_result.length > 0 ? package_result[0].packname : '',
                        price:package_result.length > 0 ? package_result[0].price : '',
                        gst:package_result.length > 0 ? package_result[0].gst : '',
                        total: package_result.length > 0 ? package_result[0].total : '',
                        mode_of_paymet: mode_of_payment,
                        reference_id:reference_id,
                        validity: package_result[0].duration,
                        activedate: '',
                        expiredate: '',
                        status:'Pending'
                        
                    };
                    try
                    {
                        
                        const [scheme_summary_result] = await connection2.query(
                            "INSERT INTO schemesummarys SET ?",
                            [scheme_data]
                        );
                    }
                    
                    catch (error)
                    {
                        console.log(error)
                    }
                    return res.json({scheme_data})
                }
                catch (error)
                {
                    console.log(error)
                }
                // return res.json({data})
                return res.status(200).json({
                    statuscode: "3",
                    status: "Pending",
                    reference_id,
                    data:data.data.data.encodedDynamicQrCode,
                });
            } catch (error) {
                console.error(error);
                connection.release();
                if (connection2) connection2.release();
                return res.status(500).json({
                    status_code: "2",
                    status: "failed",
                    message: "Error generating UPI link",
                });
            }
        } else if (mode_of_payment.toLowerCase() === "cash") {
            // Handle cash payment logic here, similar to your original code
            // For example, updating database tables to reflect payment and activation
        }

        // Other mode of payment handling can be added here

    } catch (error) {
        console.error(error);
        if (connection) connection.release();
        if (connection2) connection2.release();
        return res.status(500).json({
            status_code: "2",
            status: "failed",
            message: "Internal Server Error",
        });
    }
});

// Sales Manager Appoint / Created Area Sales Manager Account start

//sms pending
router.get("/my-sm", requireStaffLogin, async (req, res) => {
    const connection = await poolPromise().getConnection();
    
    try
    {
        if (req.staff.designation_id !== "002")
        {
            return res.json({
                status_code: "2",
                status: "failed",
                message:"Allowed only for ASM"
            })
            }
        const [staff_result] = await connection.query("SELECT * FROM staff_data WHERE emp_id  = (SELECT mapping FROM staff_data WHERE unique_id = ?)",
            [req.staff.unique_id])
        if (staff_result.length === 0)
        {
            return res.json({
                status_code: "2",
                status: "failed",
                message:"Sales Manager not found"
                
            })
        }
        return res.json({
            status_code: "1",
            status: "success",
                mobile:staff_result[0].mobile,
                message:"Sales Manager found"
        })
    } catch (error) {
        console.log(error)
    }
})

router.get("/my-mapping", requireStaffLogin, async (req, res) => {
    const connection = await poolPromise().getConnection();
    
    try
    {
        if (req.staff.designation_id !== "002" &&  req.staff.designation_id !== "001" )
        {
            return res.json({
                status_code: "2",
                status: "failed",
                message:"Allowed only for ASM and SM"
            })
        }

        if (req.staff.designation_id == "002")
        {
            const [staff_result] = await connection.query("SELECT * FROM staff_data WHERE emp_id  = (SELECT mapping FROM staff_data WHERE unique_id = ?)",
                [req.staff.unique_id])
            if (staff_result.length === 0)
            {
                return res.json({
                    status_code: "2",
                    status: "failed",
                    message: "Sales Manager not found"
                
                })
            }
            return res.json({
                status_code: "1",
                status: "success",
                data: { name: staff_result[0].name , mobile :staff_result[0].mobile,  },
                message: "Sales Manager found"
            })
        }
        if (req.staff.designation_id == "001")
        {
            const [staff_result] = await connection.query("SELECT * FROM staff_data WHERE mapping = ?",
                [req.staff.emp_id])
            
            if (staff_result.length === 0)
            {
                return res.json({
                    status_code: "2",
                    status: "failed",
                    message: "No Area Sales Manager found"
                
                })
            }
            const mobileNumbers = staff_result.map(staff => {
                return {
                    name: staff.name,
                    mobile: staff.mobile
                }
            });
            return res.json({
                status_code: "1",
                status: "success",
                data: mobileNumbers,
                message: "Area Sales Managers found"
            })
        }

    } catch (error) {
        return res.json({
                    status_code: "2",
                    status: "failed",
                    message: "Internal Server Error"
                
                })
    }
})


router.get("/get-merchant-details/:customer_id", requireStaffLogin, async (req, res) => {
    const connection3 = await poolPromise2().getConnection();
    const customer_id = req.params.customer_id;
    try
    {
        const merchant_details = {

        }
        const [user_result] = await connection3.query("SELECT * FROM users where customer_id = ?", [customer_id])
        if (user_result.length === 0)
        {
            return res.json({
                status_code: "2",
                status: "failed",
                message: "User not Found"
            
            })
        }
        const [business_result] = await connection3.query("SELECT * FROM business_profile where unique_id = ?", [user_result[0].unique_id])
        if (user_result.length === 0)
        {
            return res.json({
                status_code: "2",
                status: "failed",
                message: "Business Profile not Found"
            
            })
        }
        const [wallet_result] = await connection3.query("SELECT * FROM wallet where unique_id = ?", [user_result[0].unique_id])
        if (user_result.length === 0)
        {
            return res.json({
                status_code: "2",
                status: "failed",
                message: "Wallet not Found"
            
            })
        }
        merchant_details.name = user_result[0].name
        merchant_details.mobile = user_result[0].mobile
        merchant_details.package = user_result[0].package_id
        merchant_details.status = user_result[0].status
        merchant_details.package_expiry = user_result[0].expiry
        merchant_details.trade_name = business_result[0].trade_name;
        merchant_details.entity_type = business_result[0].entity_type;
        merchant_details.registration_number = business_result[0].registration_no;
        merchant_details.wallet = wallet_result[0].wallet;
        return res.json({
            status_code: "1",
            status: "success",
            message: "Merchant Details Found",
            data:merchant_details
        
        })

       

    } catch (error) {
        return res.json({
                    status_code: "2",
                    status: "failed",
                    message: "Internal Server Error"
                
                })
    }
})

router.get("/get-merchant-details", requireStaffLogin, async (req, res) => {
    const connection3 = await poolPromise2().getConnection();
    try
    {
        const emp_id = req.staff.emp_id;
        const [merchant_results] = await connection3.query("SELECT * FROM users where created_by = ?", [emp_id]);
        if (merchant_results.length === 0)
        {
            return res.json({
                status_code: "2",
                status: "failed",
                message: "User not Found"
            
            })
        }
        const merchant_details = merchant_results.map(m => {
            return {
                name: m.name,
                mobile:m.mobile,
                customer_id: m.customer_id,
                status:m.status
            }
        })
        
        return res.json({
            status_code: "1",
            status: "success",
            message: "Merchant Details Found",
            data: merchant_details
        
        })
    }
    catch (error)
    {
        return res.json({
            status_code: "2",
            status: "failed",
            message: "Internal Server Error"
        
        })
    }
})
router.post("/add-employee", requireStaffLogin, async (req, res) => {
    try {
        const emp_id = req.staff.emp_id;
        const {
            Name,
            contact_no,
            email_id,
            
        } = req.body;
        const uqid = uuid.v4();
        let Employee_ID, application_id;
        const department_id ="2";
        const designation_id = "002";

        // Use promise-based connection
        const connection = await poolPromise().getConnection();

        try {
            const sql_check_sec_key = "SELECT * FROM staff_data WHERE mobile = ?";
            const value = [contact_no];

            const [staff_data] = await connection.query(sql_check_sec_key, value);

            if (staff_data.length > 0)
            {
                return res
                    .status(422)
                    .json({
                        status_code: "2",
                        status: "failed",
                        message: "Employee already exists"
                    });
            } else
            {
                if (req.staff.designation_id !== "001" && req.staff.designation_id !== "002" )
                {
                    
                    return res.json({
                        status_code: "2",
                        status: "failed",
                        message:"You are not authorized to add employee"
                        
                    })
                }
                // if (designation_id !== "002")
                // {
                    
                //     return res.json({
                //         status_code: "2",
                //         status: "failed",
                //         message:"Sales Manager Cannot be assigned by other Sales Manager"
                        
                //     })
                // }
                application_id = Date.now();
                Employee_ID= emp_id.substring(0,4) + String(Date.now()).slice(-5);
                const [result_department] = await connection.query("SELECT * FROM department WHERE id = ?", [department_id ?? "1"])
                // if (result_department.length === 0)
                // {
                //     return res.json({
                //         status_code: "2",
                //         status: "failed",
                //         message:"Department with Id does not exist"
                //     })
                // }
                 const [result_designation] = await connection.query("SELECT * FROM designation WHERE id = ?", [designation_id ?? "001"])

                 

                const insertValues = [
                    uqid,
                    Employee_ID,
                    department_id,
                    result_designation[0].designation_id,
                    result_designation[0].designation,
                    result_department[0].department,
                    application_id,
                    Name,
                    contact_no,
                    email_id,
                    emp_id,
                ];

                const sql_insert =
                    "INSERT INTO `staff_data` (`unique_id`,`emp_id`, `department_id`, `designation_id`,`designation`, `department`,`application_id`, `name`, `mobile`, `email` ,`mapping`) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?,?,?)";

                const [insertData] = await connection.query(sql_insert, insertValues);

                if (insertData.affectedRows >= 1) {
                    // await smsapi(
                    //     "admin",
                    //     "employer_registration",
                    //     contact_no,
                    //     result_designation[0].designation,
                    //     Employee_ID,
                    //     "crms.egpaid.in"
                    // );
                    console.log(`contact-no ${contact_no}  designation ${result_designation[0].designation} , employee ${Employee_ID} `)
                   await  smsapi("admin", "employee_on_boarded", contact_no,result_designation[0].designation ,Employee_ID, "crms.egpaid.in");

                    return res.status(200).json({
                        status_code: "1",
                        status: "success",
                        Message: "Successfully Registered",
                        Employee_ID,
                        Name,
                    });
                }
            }
        } catch (err) {
            console.error(err);
            return res.status(422).json({
                status_code: "2",
                status: "failed",
                error: err.message
            });
        } finally {
            // Release the connection
            if (connection) {
                await connection.release();
            }
        }
    } catch (err) {
        return res.status(422).json({
            status_code: "2",
            status: "failed",
            error: err.message
        });
    }
});

router.post("/appoint", requireStaffLogin, async (req, res) => {
    try {
        const {
            authorization,
            key
        } = req.headers;
        const token = authorization.replace("Bearer ", "");
        const {
            applicationId,
            joiningDate,
            managerId,
            salary,
            shiftsId,
            officeMobile,
            officeEmail,
            territory
        } = req.body;
        const emp_id = req.staff.emp_id;

        const connection = await poolPromise().getConnection();

        try {
            // Check secret key
            const sql = "SELECT id FROM secret_key WHERE secret_key = ?";
            const value = [key];
            const [fetchedKey] = await connection.query(sql, value);

            if (fetchedKey.length === 0) {
                return res
                    .status(422)
                    .json({
                        status_code: "2",
                        status: "failed",
                        message: "INVALID API KEY"
                    });
            }

            // Get department from data
            const sql_department_query = "SELECT * FROM staff_data WHERE application_id = ?";
            const sql_department_value = [applicationId];
            const [staffData] = await connection.query(sql_department_query, sql_department_value);


            if (staffData.length === 0) {
                return res.status(422).json({
                    status_code: "2",
                    status: "failed",
                    message: "Staff does not  exists"
                });
            }
            const status_value = parseInt(staffData[0]['status']);
            if (!(status_value === 2)) {
                return res.status(422).json({
                    status_code: "2",
                    status: "failed",
                    error: "Employee cannot be appointed to any territory"
                });

            }
            const department_value = staffData[0]['department'];
            const designation_value = staffData[0]['designation'];


            if (department_value === "Marketing" && !territory) {
                return res.status(422).json({
                    status_code: "2",
                    status: "failed",
                    message: "Territory is mandatory for Marketing department"
                });
            }

            if (designation_value === "Area Sales Manager") {
                if (territory.length > 0) {
                    //Get List of all districts
                    let districts = territory.map(t => t["district_name"]);
                    if (districts.length === 0) {
                        return res.status(422).json({
                            status_code: "2",
                            status: "failed",
                            message: "Area Sales Manager can only be appointed to specific district"
                        });

                    }
                    const districts_query = `SELECT DISTINCT district_name, state_name FROM district WHERE district_name IN (${districts.map(() => '?').join(',')})`;
                    const districts_value = [...districts];
                    const confirmed_districts = await connection.query(districts_query, districts_value);

                    if (confirmed_districts[0].length === 0) {
                        return res.status(422).json({
                            status_code: "2",
                            status: "failed",
                            message: "Unknown districts"
                        });
                    }

                    for (let row of confirmed_districts[0]) {
                        // check teritorry
                        const sql_territory_query = "SELECT * FROM territory WHERE (district = ? AND user_type = ? AND status = ?)";
                        const sql_territory_value = [row['district_name'], 'ASM', 1];
                        const [territoryData] = await connection.query(sql_territory_query, sql_territory_value)

                        if (territoryData.length === 0)

                        {
                            const insertQuery = 'INSERT INTO territory (user_type, unique_id, district,state,status) VALUES (?, ?, ?,?,?)';
                            const insertValues = ['ASM', uuid.v4(), row['district_name'], row['state_name'], 1];
                            await connection.query(insertQuery, insertValues);
                        } else {
                            return res.status(422).json({
                                status_code: "2",
                                status: "failed",
                                message: `Area Sales Manager already exist for ${row['district_name']} district `
                            });
                        }


                    }

                }
            }
            if (designation_value === "Sales Manager") {
                if (territory.length > 0) {
                    //Get List of all states
                    let states = territory.map(t => t["state_name"]);
                    if (states.length === 0) {
                        return res.status(422).json({
                            status_code: "2",
                            status: "failed",
                            message: "Sales Manager can only be appointed to specific state"
                        });

                    }
                    const state_query = `SELECT DISTINCT state_name FROM state WHERE state_name IN (${states.map(() => '?').join(',')})`;
                    const state_value = [...states];
                    const confirmed_states = await connection.query(state_query, state_value);

                    if (confirmed_states[0].length === 0) {
                        return res.status(422).json({
                            status_code: "2",
                            status: "failed",
                            message: "Unknown State"
                        });
                    }

                    for (let row of confirmed_states[0]) {
                        // check teritorry
                        const sql_territory_query = "SELECT * FROM territory WHERE (state = ? AND user_type = ? AND STATUS = ?)";
                        const sql_territory_value = [row['state_name'], 'SM', 1];
                        const [territoryData] = await connection.query(sql_territory_query, sql_territory_value);


                        if (territoryData.length === 0)

                        {
                            const insertQuery = 'INSERT INTO territory (user_type, unique_id,district,state,status) VALUES (?, ?,?, ?,?)';
                            const insertValues = ['SM', uuid.v4(), " ", row['state_name'], 1];
                            await connection.query(insertQuery, insertValues);
                        } else {
                            return res.status(422).json({
                                status_code: "2",
                                status: "failed",
                                message: `Sales Manager already exist for ${row['state_name']} state `
                            });
                        }

                    }

                }
            }

            // appointing 
            const staff_query = "UPDATE staff_data SET joining_date = ? ,salary = ? , shifts_id = ? , office_mobile = ? , office_email =  ? , approve_by = ? , status = ? WHERE application_id = ? ";
            const staff_values = [joiningDate, salary, shiftsId, officeMobile, officeEmail, 3600, 1, applicationId];
            const [values] = await connection.query(staff_query, staff_values);



            smsapi("admin", "appoint", officeMobile, applicationId);

            return res.json({
                status: "sucess",
                status_code: "1",
                message: "Employee has been appointed to territory"

            })

        } catch (err) {
            console.error(err);
            return res.status(422).json({
                status_code: "2",
                status: "failed",
                error: err.message
            });
        } finally {
            if (connection) {
                await connection.release();
            }
        }
    } catch (err) {
        return res.status(422).json({
            status_code: "2",
            status: "failed",
            error: err.message
        });
    }
});



router.post("/get-asm", requireStaffLogin, async (req, res) => {
    const connection = await poolPromise().getConnection();
    const emp_id = req.staff.emp_id;
    try {
        // Fetch ASM details from staff_data table
        const [asmDetails] = await connection.query(
            "SELECT emp_id, name, status, mobile FROM staff_data WHERE designation = 'Area Sales Manager' AND `mapping` = ?",
            [emp_id]
        );

        return res.status(200).json({
            status_code: "1",
            status: "success",
            data: asmDetails,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            status_code: "2",
            status: "failed",
            message: "Internal Server Error",
        });
    } finally {
        if (connection) {
            await connection.release();
        }
    }
});

// Sales Manager Appoint / Created Area Sales Manager Account end

//ticket start

router.post("/add-task", requireStaffLogin, async (req, res) => {
    const connection = await poolPromise().getConnection();

    try {
        const {
            send_to,
            message,
            subject
        } = req.body;
        const send_from = req.staff.mobile;
        // Generate a random 9-digit msg_id
        const msgId = Math.floor(100000000 + Math.random() * 900000000);

        // Insert data into work_report table
        await connection.query(
            "INSERT INTO work_report (send_from, send_to, messa_type, msg_id, subject, message, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [send_from, send_to, "new", msgId, subject, message, "New"]
        );

        return res.status(200).json({
            status_code: "02",
            status: "success",
            message: "Task added successfully",
            subject: subject,
            msg_id: msgId,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            status_code: "01",
            status: "failed",
            message: "Internal Server Error",
        });
    } finally {
        await connection.release();
    }
});

router.get("/view", requireStaffLogin, async (req, res) => {
    const connection = await poolPromise().getConnection();

    try
    {
        const userMobile = req.staff.mobile;

        // Fetch data from work_report table based on user email
        const [result] = await connection.query(
            "SELECT id, send_from, send_to, messa_type, msg_id, subject, message, status, DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at FROM work_report WHERE (send_from = ? OR send_to = ?) AND status IN (?, ?) ORDER BY created_at ASC, id ASC",
            [userMobile, userMobile, "New", "Read"]
        );
        await connection.query(
            "UPDATE work_report SET status = ? WHERE (send_from = ? OR send_to = ?) AND status = 'New' ",
            ["Read", userMobile, userMobile]
        );
        const modifiedResult = []
        for (const item of result)
        {
            try {
                const [send_from_obj] = await connection.query("SELECT * FROM staff_data WHERE mobile = ?", [item.send_from]);
                const send_from_val = {
                    "name": send_from_obj[0].name,
                    "mobile": item.send_from,
                    "profile_photo":send_from_obj[0].profile_photo
                }
                item.send_from = send_from_val
            } catch (error) {
                console.log(error)
            }
            try {
                const [send_to_obj] = await connection.query("SELECT * FROM staff_data WHERE mobile = ?", [item.send_to]);
                const send_to_val = {
                    "name": send_to_obj[0].name,
                    "mobile": item.send_to,
                    "profile_photo":send_to_obj[0].profile_photo
                }
                item.send_to = send_to_val
            } catch (error) {
                console.log(error)
                
            }
            modifiedResult.push(item)
            
            
            
        }
        return res.status(200).json({
            status_code: "02",
            status: "success",
            message: "Data retrieved successfully",
            data: modifiedResult,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            status_code: "01",
            status: "failed",
            message: "Internal Server Error",
        });
    } finally {
        await connection.release();
    }
});


router.get("/inbox", requireStaffLogin, async (req, res) => {
    const connection = await poolPromise().getConnection();

    try
    {
        const userMobile = req.staff.mobile;

        // Fetch data from work_report table based on user email
        const [result] = await connection.query(
            "SELECT id, send_from, send_to, messa_type, msg_id, subject, message, status, DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at FROM work_report WHERE send_to = ? AND status IN (?, ?) ORDER BY created_at ASC, id ASC",
            [userMobile, "New", "Read"]
        );
        // return res.json({result})
        // await connection.query(
        //     "UPDATE work_report SET status = ? WHERE send_to = ? AND status = 'New' ",
        //     ["Read", userMobile]
        // );
        const modifiedResult = []
        for (const item of result)
        {
            try {
                const [send_from_obj] = await connection.query("SELECT * FROM staff_data WHERE mobile = ?", [item.send_from]);
                const  send_from_val = {
                    "name": send_from_obj[0].name,
                    "mobile": item.send_from,
                    "profile_photo": send_from_obj[0].profile_photo,
                    "send_at":item.created_at,
                    "subject": item.subject,
                    "status": item.status,
                    "message_type": item.messa_type,
                    "msg_id":item.msg_id
                    
                }
                delete item.send_to
                modifiedResult.push(send_from_val)
            } catch (error) {
                console.log(error)
            }
           
            
            
            
        }
        return res.status(200).json({
            status_code: "1",
            status: "success",
            message: "Data retrieved successfully",
            data: modifiedResult.length !== 0 ? { send_from: modifiedResult } : "You have no messages" 

        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            status_code: "01",
            status: "failed",
            message: "Internal Server Error",
        });
    } finally {
        await connection.release();
    }
});

router.get("/outbox", requireStaffLogin, async (req, res) => {
    const connection = await poolPromise().getConnection();

    try
    {
        const userMobile = req.staff.mobile;

        // Fetch data from work_report table based on user email
        const [result] = await connection.query(
            "SELECT id, send_from, send_to, messa_type, msg_id, subject, message, status, DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at FROM work_report WHERE send_from = ? AND status IN (?, ?) ORDER BY created_at ASC, id ASC",
            [userMobile, "New", "Read"]
        );
        // await connection.query(
        //     "UPDATE work_report SET status = ? WHERE send_from = ? AND status = 'New' ",
        //     ["Read", userMobile]
        // );
        const modifiedResult = []
        for (const item of result)
        {
        
            try {
                const [send_to_obj] = await connection.query("SELECT * FROM staff_data WHERE mobile = ?", [item.send_to]);
                const send_to_val = {
                    "name": send_to_obj[0].name,
                    "mobile": item.send_to,
                    "profile_photo": send_to_obj[0].profile_photo,
                    "received_at":item.created_at,
                    "subject": item.subject,
                    "status": item.status,
                    "message_type": item.messa_type,
                    "msg_id":item.msg_id
                }
                modifiedResult.push(send_to_val)
            } catch (error) {
                console.log(error)
                
            }
            
            
            
        }
        return res.status(200).json({
            status_code: "1",
            status: "success",
            message: "Data retrieved successfully",
            data: modifiedResult.length !== 0 ?{send_to : modifiedResult}: "You have no messages" ,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            status_code: "01",
            status: "failed",
            message: "Internal Server Error",
        });
    } finally {
        await connection.release();
    }
});

router.get("/view/:message_id", requireStaffLogin, async (req, res) => {
    const connection = await poolPromise().getConnection();
    const message_id = req.params.message_id;
    try
    {
        const userMobile = req.staff.mobile;

        // Fetch data from work_report table based on user email
        const [result] = await connection.query(
            "SELECT id, send_from, send_to, messa_type, msg_id, subject, message, status, DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS created_at FROM work_report WHERE (send_from = ? OR send_to = ?) AND msg_id = ? AND status IN (?, ?) ORDER BY created_at ASC, id ASC",
            [userMobile, userMobile, message_id,"New", "Read"]
        );
        await connection.query(
            "UPDATE work_report SET status = ? WHERE send_to = ?  and msg_id = ? AND status = 'New' ",
            ["Read", userMobile,message_id]
        );
        const modifiedResult = []
        let first = true;
        for (const item of result)
        {
            try {
                const [send_from_obj] = await connection.query("SELECT * FROM staff_data WHERE mobile = ?", [item.send_from]);
                const send_from_val = {
                    "name": send_from_obj[0].name,
                    "mobile": item.send_from,
                    "profile_photo":send_from_obj[0].profile_photo
                }
                if (first === true)
                {
                    send_from_val.msg_id = item.msg_id;
                    send_from_val.subject = item.subject;
                   
                    first = false;
                }
                item.send_from = send_from_val
                delete item.id
                delete item.msg_id;
                delete item.subject;
            } catch (error) {
                console.log(error)
            }
            try {
                const [send_to_obj] = await connection.query("SELECT * FROM staff_data WHERE mobile = ?", [item.send_to]);
                const send_to_val = {
                    "name": send_to_obj[0].name,
                    "mobile": item.send_to,
                    "profile_photo":send_to_obj[0].profile_photo
                }
                item.send_to = send_to_val
            } catch (error) {
                console.log(error)
                
            }
            modifiedResult.push(item)
            
            
            
        }
        return res.status(200).json({
            status_code: "1",
            status: "success",
            message: "Data retrieved successfully",
            data: modifiedResult,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            status_code: "01",
            status: "failed",
            message: "Internal Server Error",
        });
    } finally {
        await connection.release();
    }
});

router.post("/reply", requireStaffLogin, async (req, res) => {
    const connection = await poolPromise().getConnection();

    try {
        const {
            msg_id,
            message
        } = req.body;
        const userMobile = req.staff.mobile;

        // Fetch data from work_report table based on msg_id
        const [originalMessage] = await connection.query(
            "SELECT send_from, subject FROM work_report WHERE msg_id = ? ",
            [msg_id]
        );

        if (originalMessage.length === 0) {
            return res.status(200).json({
                status_code: "02",
                status: "failed",
                message: "Original message not found",
            });
        }

        // Insert data for the reply into work_report table
        await connection.beginTransaction();

        await connection.query(
            "INSERT INTO work_report (send_from, send_to, messa_type, msg_id, subject, message, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [
                userMobile,
                originalMessage[originalMessage.length - 1].send_from,
                "reply",
                msg_id,
                originalMessage[0].subject,
                message,
                "New",
            ]
        );

        await connection.commit();

        return res.status(200).json({
            status_code: "02",
            status: "success",
            message: "Reply sent successfully",
            msg_id,
        });
    } catch (error) {
        console.error(error);
        await connection.rollback();
        return res.status(500).json({
            status_code: "01",
            status: "failed",
            message: "Internal Server Error",
        });
    } finally {
        await connection.release();
    }
});

router.post("/work-report", requireStaffLogin, async (req, res) => {
    const connection = await poolPromise().getConnection();

    try {
        const {
            msg_id,
            mobile
        } = req.body;
        const userMobile = req.staff.mobile;
        let query;
        let queryParams;

        if (msg_id) {
            // If msg_id is provided, fetch data based on msg_id
            query =
                "SELECT * FROM work_report WHERE msg_id = ? ORDER BY created_at ASC";
            queryParams = [msg_id];
        } else if (mobile) {
            // If mobile is provided, fetch data based on mobile
            query =
                "SELECT * FROM work_report WHERE (send_from = ? OR send_to = ?) ORDER BY created_at ASC";
            queryParams = [mobile, mobile];
        } else {
            // If neither msg_id nor mobile is provided, return an error
            return res.status(200).json({
                status_code: "02",
                status: "failed",
                message: "Either msg_id or mobile must be provided",
            });
        }

        // Fetch data from work_report table
        const [workReportData] = await connection.query(query, queryParams);

        return res.status(200).json({
            status_code: "02",
            status: "success",
            message: "Work report data retrieved successfully",
            data: workReportData,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            status_code: "2",
            status: "failed",
            message: "Internal Server Error",
        });
    } finally {
        await connection.release();
    }
});

//ticket end

router.get("/key", (req, res) => {
    const key = "b977803d-0218-456e-a676-79de8c42f4b6";
    const encodedKey = Buffer.from(key).toString("base64");
    const Timestamp = Date.now().toString();
    const signature = crypto
        .createHmac("sha256", encodedKey)
        .update(Timestamp)
        .digest("binary");
    const secretKey = Buffer.from(signature, "binary").toString("base64");
    return res.status(200).json({
        secretKey,
        Timestamp
    });
});



router.post('/insertdata', requireStaffLogin, async (req, res) => {

    const connection = await poolPromise().getConnection();
    try {

        var unique_id = req.staff.unique_id;

        const {
            owner_name,
            shop_name,
            mobile,
            address,
            remark,
            coordinates
        } = req.body;
        if (!owner_name || !shop_name || !mobile || !address || !remark || !coordinates) {
            return res.status(422).json({
                status: "fail",
                message: "Please provide all details"
            });
        }

        // Check employee status
        const empDetailsQuery = 'SELECT id FROM staff_data WHERE unique_id = ? AND status = ?';
        const empDetailsValue = [unique_id, '1']
        const [empdetails] = await connection.query(empDetailsQuery, empDetailsValue);
        console.log(empdetails)
        if (empdetails.length === 0) {
            return res.status(422).json({
                status: "fail",
                message: "Your Account was not active"
            })
        }
        console.log(empdetails)

        //Ensure the mobile number is unique
        const checkMobileQuery = 'SELECT * FROM visiting_data WHERE mobile = ?';
        const checkMobileValues = [mobile];
        const existingMobile = await connection.query(checkMobileQuery, checkMobileValues);

        if (existingMobile[0].length > 0) {
            return res.status(422).json({
                status_code: "2",
                status: "failed",
                message: "Mobile number already exists"
            });
        }
        const addressJson = JSON.stringify(address)
        moment().tz("Asia/Calcutta").format();
        process.env.TZ = 'Asia/Calcutta';
        const timestamp = moment().format('YYYY-MM-DD HH:mm:ss');
        const insertDsrQuery = 'INSERT INTO visiting_data (unique_id, owner_name, shop_name, mobile, address, remark, timestamp, coordinates) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
        const insertDsrValues = [unique_id, owner_name, shop_name, mobile, addressJson, remark, timestamp, coordinates];
        await connection.query(insertDsrQuery, insertDsrValues);

        return res.status(201).json({
            status: "success",
            message: "Visiting list updated successfully."
        });
    } catch (err) {
        console.error('Error:', err);
        return res.status(400).json({
            status_code: "2",
            status: "failed",
            message: "An error occurred",
            error: err.message
        });
    } finally {
        connection.release();
    }
});

router.post('/dsrreport', requireStaffLogin, async (req, res) => {


    const connection = await poolPromise().getConnection();

    try {
        var unique_id = req.staff.unique_id;
        var id = req.staff.id;
        const {
            page,
            limit,
            toDate,
            fromDate
        } = req.body;

        const date = moment().format('YYYY-MM-DD');

        if (toDate === '' || fromDate === '') {
            const sql1 = 'SELECT id, owner_name, shop_name, mobile, address FROM visiting_data WHERE unique_id = ? AND DATE(timestamp) = ?';
            const values1 = [unique_id, date];
            const [visiting_info] = await connection.query(sql1, values1);
            return res.json({visiting_info})
            if (!(visiting_info[0].length > 0)) {
                return res.status(422).json({
                    status_code: "2",
                    status: "failed",
                    message: "No DSR report found"
                });
            } else
            {
                const final_result = visiting_info.map(({ id,...rest }) => rest);
                return res.json({
                    status_code:"1",
                    status: "success",
                    data:final_result
                });
            }
        } else {
            const offset = (page - 1) * limit;
            const sql = `SELECT id, owner_name, shop_name, mobile, address FROM visiting_data WHERE unique_id = ? AND DATE(timestamp) BETWEEN ? AND ? LIMIT ? OFFSET ?`;
            const values = [unique_id, fromDate, toDate, limit, offset];

            const [dsr] = await connection.query(sql, values);
            console.log(dsr)
            if (!(dsr?.length > 0)) {
                return res.status(422).json({
                    status_code: "2",
                    status: "failed",
                    message: "No DSR report found"
                });
            } else
            {
                const final_result = dsr.map(({ id,...rest }) => rest);
                return res.json({
                    status_code:"1",
                    status: "success",
                    data:final_result
                });
            }
        }
    } catch (err) {
        console.error('Error:', err);
        return res.status(400).json({
            status_code: "2",
            status: "failed",
            error: err
        });
    } finally {
        connection.release();
    }
});

router.get('/dsrreport/:id', requireStaffLogin, async (req, res) => {


    const connection = await poolPromise().getConnection();
    try {
        const id = req.params.id;
        var unique_id = req.staff.unique_id;
        const sql = 'SELECT * FROM visiting_data WHERE unique_id = ? AND id = ?';
        const values = [unique_id, id];
        const [dsr] = await connection.query(sql, values);
        if (dsr[0].length === 0) {
            return res.status(422).json({
                status: "fail",
                message: "No DSR report found"
            });
        } else {
            return res.json(dsr[0]);
        }
    } catch (err) {
        console.error('Error:', err);
        return res.status(400).json({
            status_code: "2",
            status: "failed",
            error: err
        });
    } finally {
        connection.release();
    }
});

router.post('/fetch-visiting-info', requireStaffLogin, async (req, res) => {
    // return res.json({data:`/fetch-visiting-info reached`})
    const { employee_id, page, limit, from_date, to_date } = req.body
    const connection = await poolPromise().getConnection();
    try
    {
        // if (req.staff.designation_id !== "001")
        // {
        //     return res.status(500).json({
        //         status_code: "2",
        //         status: "failed",
        //         message: `Unauthorized access`,
        //     });
        // }
        const [staff_result] = await connection.query("SELECT * FROM staff_data where emp_id = ?", [employee_id]);
        if (staff_result.length === 0)
        {
            return res.status(500).json({
                status_code: "2",
                status: "failed",
                message: `Employee with ${employee_id} does not exist`,
              });
        }

        // Calculate the offset based on page and limit for pagination
        const offset = (page - 1) * limit;
        const [visiting_result] = await connection.query("SELECT shop_name,owner_name,mobile,address,timestamp FROM visiting_data WHERE unique_id = ? AND timestamp BETWEEN ? AND ? LIMIT ? OFFSET ?",
        [staff_result[0].unique_id,from_date + " 00:00:00", to_date + " 23:59:59",parseInt(limit),parseInt(offset)])
        if (visiting_result.length === 0)
        {
            return res.status(500).json({
                status_code: "2",
                status: "failed",
                message: "no history found in between these two dates",
              });
        }
        const updatedData = visiting_result.map(entry => {
            return {
                ...entry,
                address: entry.address.area_name
            };
        });
        return res.status(200).json({
            status_code: "1",
            status: "success",
            data: updatedData,
          });
    } catch (error) {
        console.error(error);
    return res.status(500).json({
      status_code: "2",
      status: "failed",
      message: "Internal Server Error",
    });
    }
})

router.post('/fetch-distributor', requireStaffLogin, async (req, res) => {
    // return res.json({data:`/fetch-visiting-info reached`})
    const { employee_id, page, limit, from_date, to_date } = req.body
    const connection = await poolPromise().getConnection();
    try
    {
       
        // if (req.staff.designation_id !== "001")
        // {
        //     return res.status(500).json({
        //         status_code: "2",
        //         status: "failed",
        //         message: `Unauthorized access`,
        //     });
        // }
        const [staff_result] = await connection.query("SELECT * FROM staff_data where emp_id = ?", [employee_id]);
        if (staff_result.length === 0)
        {
            return res.status(500).json({
                status_code: "2",
                status: "failed",
                message: `Employee with ${employee_id} does not exist`,
              });
        }
        // Calculate the offset based on page and limit for pagination
        const offset = (page - 1) * limit;
        const [visiting_result] = await connection.query("SELECT customer_id,application_id,mobile_number,created_date,created_by FROM login WHERE created_by = ? AND created_date BETWEEN ? AND ? LIMIT ? OFFSET ?",
        [staff_result[0].emp_id,from_date, to_date,parseInt(limit),parseInt(offset)])
        if (visiting_result.length === 0)
        {
            return res.status(500).json({
                status_code: "2",
                status: "failed",
                message: "no history found in between these two dates",
              });
        }
     
        return res.status(200).json({
            status_code: "1",
            status: "success",
            data: visiting_result,
          });
    } catch (error) {
        console.error(error);
    return res.status(500).json({
      status_code: "2",
      status: "failed",
      message: "Internal Server Error",
    });
    }
  })
router.post('/fetch-merchant', requireStaffLogin, async (req, res) => {
    // return res.json({data:`/fetch-visiting-info reached`})
    const { employee_id, page, limit, from_date, to_date } = req.body
    const connection = await poolPromise().getConnection();
    const connection3 = await poolPromise2().getConnection();
    try
    {
       
        // if (req.staff.designation_id !== "001")
        // {
        //     return res.status(500).json({
        //         status_code: "2",
        //         status: "failed",
        //         message: `Unauthorized access`,
        //     });
        // }
        const [staff_result] = await connection.query("SELECT * FROM staff_data where emp_id = ?", [employee_id]);
        if (staff_result.length === 0)
        {
            return res.status(500).json({
                status_code: "2",
                status: "failed",
                message: `Employee with ${employee_id} does not exist`,
              });
        }
        // Calculate the offset based on page and limit for pagination
        const offset = (page - 1) * limit;
        const [visiting_result] = await connection3.query("SELECT name,mobile,email_id,customer_id,package_id,created_by,created_date FROM  users WHERE created_by = ? AND created_date BETWEEN ? AND ? LIMIT ? OFFSET ?",
        [staff_result[0].emp_id,from_date, to_date,parseInt(limit),parseInt(offset)])
        if (visiting_result.length === 0)
        {
            return res.status(500).json({
                status_code: "2",
                status: "failed",
                message: "no history found in between these two dates",
              });
        }
     
        return res.status(200).json({
            status_code: "1",
            status: "success",
            data: visiting_result,
          });
    } catch (error) {
        console.error(error);
    return res.status(500).json({
      status_code: "2",
      status: "failed",
      message: "Internal Server Error",
    });
    }
})


router.get('/get-csp', requireStaffLogin, async (req, res) => {
    // return res.json({data:`/fetch-visiting-info reached`})
    
    const connection = await poolPromise().getConnection();
    const connection2 = await poolPromise2().getConnection();
    try
    {
       
        // if (req.staff.designation_id !== "001")
        // {
        //     return res.status(500).json({
        //         status_code: "2",
        //         status: "failed",
        //         message: `Unauthorized access`,
        //     });
        // }
        // const [staff_result] = await connection.query("SELECT * FROM staff_data where mapping = ?", [req.staff.emp_id]);
        // if (staff_result.length === 0)
        // {
        //     return res.status(500).json({
        //         status_code: "2",
        //         status: "failed",
        //         message: `Employee with ${employee_id} does not exist or not authorized to fetch Asp for  ${employee_id} `,
        //       });
        // }
    
        const [mapping_result] = await connection2.query("SELECT * FROM mappings where created_by = ? ", [req.staff.emp_id]);
        if (mapping_result.length === 0)
        {
            return res.status(500).json({
                status_code: "2",
                status: "failed",
                message: `No mappings found`,
              });
        }
        // Calculate the offset based on page and limit for pagination
        const unique_ids = mapping_result.map(t => t.unique_id);
        // return res.json({unique_ids})
        
        const [visiting_result] = await connection2.query(`
    SELECT  m.photo as profile_photo,
        m.unique_id,
        m.customer_id,
        m.entity_name,
        m.authorized_person_name,
        a.mobile,
        a.status
    FROM auths a
    LEFT JOIN merchants m ON a.unique_id = m.unique_id
    WHERE a.unique_id IN (?) `,
    [unique_ids]
);
        
        if (visiting_result.length === 0)
        {
            return res.status(500).json({
                status_code: "2",
                status: "failed",
                message: "No Data Found",
            });
        }
        // const [merchant_result] = connection2.query(`SELECT * FROM merchants WHERE unique_id IN (?) `, [unique_ids]);

     
        return res.status(200).json({
            status_code: "1",
            status: "success",
            data: visiting_result,
          });
    } catch (error) {
        console.error(error);
    return res.status(500).json({
      status_code: "2",
      status: "failed",
      message: "Internal Server Error",
    });
    }
})
router.post('/fetch-csp', requireStaffLogin, async (req, res) => {
    // return res.json({data:`/fetch-visiting-info reached`})
    const { employee_id, page, limit, from_date, to_date } = req.body
    const connection = await poolPromise().getConnection();
    const connection2 = await poolPromise2().getConnection();
    try
    {
       
        // if (req.staff.designation_id !== "001")
        // {
        //     return res.status(500).json({
        //         status_code: "2",
        //         status: "failed",
        //         message: `Unauthorized access`,
        //     });
        // }
        const [staff_result] = await connection.query("SELECT * FROM staff_data where mapping = ? and emp_id = ? ", [req.staff.emp_id, employee_id]);
        if (staff_result.length === 0)
        {
            return res.status(500).json({
                status_code: "2",
                status: "failed",
                message: `Employee with ${employee_id} does not exist or not authorized to fetch Asp for  ${employee_id} `,
              });
        }
        const [mapping_result] = await connection2.query("SELECT * FROM mappings where created_by = ? ", [employee_id]);
        if (mapping_result.length === 0)
        {
            return res.status(500).json({
                status_code: "2",
                status: "failed",
                message: `No mappings found`,
              });
        }
        // Calculate the offset based on page and limit for pagination
        const unique_ids = mapping_result.map(t => t.unique_id);
        // return res.json({unique_ids})
        
        const offset = (page - 1) * limit;
        const [visiting_result] = await connection2.query(`
    SELECT  m.photo as profile_photo,
        m.unique_id,
        m.customer_id,
        m.entity_name,
        m.authorized_person_name,
        a.mobile,
        a.status
    FROM auths a
    LEFT JOIN merchants m ON a.unique_id = m.unique_id
    WHERE a.unique_id IN (?) 
    AND a.timestamp BETWEEN ? AND ? 
    LIMIT ? OFFSET ?`,
    [unique_ids, from_date, to_date, parseInt(limit), parseInt(offset)]
);
        
        if (visiting_result.length === 0)
        {
            return res.status(500).json({
                status_code: "2",
                status: "failed",
                message: "no history found in between these two dates",
            });
        }
        // const [merchant_result] = connection2.query(`SELECT * FROM merchants WHERE unique_id IN (?) `, [unique_ids]);

     
        return res.status(200).json({
            status_code: "1",
            status: "success",
            data: visiting_result,
          });
    } catch (error) {
        console.error(error);
    return res.status(500).json({
      status_code: "2",
      status: "failed",
      message: "Internal Server Error",
    });
    }
})


router.get('/csp-details/:customer_id', requireStaffLogin, async (req, res) => {
    const customer_id = req.params.customer_id;
    const connection2 = await poolPromise2().getConnection();
    try
    {
       
        // if (req.staff.designation_id !== "001")
        // {
        //     return res.status(500).json({
        //         status_code: "2",
        //         status: "failed",
        //         message: `Unauthorized access`,
        //     });
        // }
        const [merchant_result] = await connection2.query(`SELECT m.authorized_person_name as name, m.photo,a.mobile,a.user_code, m.email,a.package_id,a.package_expiry,
        m.residential_address,m.entity_type,m.entity_name,
        m.office_address, w.wallet,w.hold,w.unsettle,w.status as wallet_status,
        mp.distributor_id, mp.agent_id,mp.asm_id,mp.services_type,mp.created_by, m.timestamp as created_at,
        a.status as status
        FROM merchants m LEFT JOIN auths a ON a.unique_id = m.unique_id LEFT JOIN wallets w ON w.unique_id = m.unique_id LEFT JOIN mappings mp ON mp.unique_id = m.unique_id  WHERE m.customer_id = ?`, [customer_id]);
        //const [merchant_result] = await connection2.query("SELECT * FROM merchants m LEFT JOIN auths a ON a.unique_id = m.unique_id LEFT JOIN wallets w ON w.unique_id = m.unique_id LEFT JOIN mappings mp ON mp.unique_id = m.unique_id WHERE m.customer_id = ?", [customer_id]);
        if (merchant_result.length === 0)
        {
            return res.status(500).json({
                status_code: "2",
                status: "failed",
                message: "Merchant Details Not Found",
              });
        }
        const statusMap = {
            1: 'Activated',
            2: 'KYC Verification is Pending',
            3: 'Activated Merchant Services is Pending',
            4: 'EKYC Is Pending',
            5: 'Merchant KYC is Pending',
            6: 'Merchant Onboard Pending',
            7: 'Mobile No Verification Pending'
        };
        const extractedData = merchant_result.map(entry => {
            return {
                ...entry,
                status:statusMap[entry.status]
            };
        });
        

        return res.status(200).json({
            status_code: "1",
            status: "success",
            data: extractedData[0],
          });
    } catch (error) {
        console.error(error);
    return res.status(500).json({
      status_code: "2",
      status: "failed",
      message: "Internal Server Error",
    });
    }
})

router.get('/distributor-details/:distributor_id', requireStaffLogin, async (req, res) => {
    const distributor_id = req.params.distributor_id;
    const connection = await poolPromise().getConnection();
    const connection2 = await poolPromise2().getConnection();
    try
    {
       
        // if (req.staff.designation_id !== "001")
        // {
        //     return res.status(500).json({
        //         status_code: "2",
        //         status: "failed",
        //         message: `Unauthorized access`,
        //     });
        // }
       
        const [detail_result_query] = await connection.query("SELECT l.unique_id,l.customer_id,l.mobile_number,d.photo,d.name, d.email , d.office_addresss,d.trade_name, d.status,l.created_date,l.created_by , s.status as stock_status , s.quantity FROM login l LEFT JOIN distributor d on l.unique_id = d.unique_id LEFT join stock s ON s.unique_id = l.unique_id where l.customer_id = ?",[distributor_id])
    
        if (detail_result_query.length === 0)
        {
            return res.status(200).json({
                status_code: "2",
                status: "failed",
                data: "No data Found",
              });
        }
        // return res.json({detail_result_query})
        const [distributor_result_query] = await connection2.query(`SELECT w.wallet,w.hold,w.unsettle,w.status FROM wallets w  where w.unique_id = ?  `, [detail_result_query[0].unique_id]);
        if (distributor_result_query.length === 0)
        {
            return res.status(500).json({
                status_code: "2",
                status: "failed",
                message: "Wallet not Found for given Distributor",
              });
        }
        const detailResult = detail_result_query[0];
        const distributorResult = distributor_result_query[0];

        const mergedObject = {
    unique_id:detailResult.unique_id,
    customer_id: detailResult.unique_id,
    photo: detailResult.photo,
            name: detailResult.name,
            email: detailResult.email,
    office_address:detailResult.office_address,
    shop_name:detailResult.trade_name,
    mobile_number: detailResult.mobile,
    created_by: distributorResult.created_by,
    asm_id: distributorResult.asm_id,
    created_date: distributorResult.time_stamp,
    status: detailResult.status,
    wallet: distributorResult,
    quantity: detailResult.quantity,
    stock_status:detailResult.stock_status
};


        return res.status(200).json({
            status_code: "1",
            status: "success",
            data: mergedObject,
          });
    } catch (error) {
        console.error(error);
    return res.status(500).json({
      status_code: "2",
      status: "failed",
      message: "Internal Server Error",
    });
    }
})

router.get('/fetch-offer-letter', requireStaffLogin, async (req, res) => {
    const connection = await poolPromise().getConnection();
    try
    {
        const employee = req.staff;
        
        const [user_result] = await connection.query(`SELECT DATE(s.joining_date) as date, CONCAT(sh.start_time ,' - ', sh.end_time) as shifts, '2 months' as period , s.salary * 12 as ctc FROM  staff_data s JOIN shifts sh ON s.shifts_id = sh.shift_id  where unique_id = ? `, [employee.unique_id]);
        const all_details = user_result.map(result => {
            return {
                name:employee.name,
                designation:employee.designation,
                ...result,
                date:new Date(result.date).toLocaleDateString()
          }
        });
        const [appoint_result] = await connection.query("SELECT * FROM  appointment_letter WHERE designation_id = ?", [employee.designation_id])
        // Fetch the description from the appoint_result
const { description } = appoint_result[0];

// Replace placeholders with values from all_details
const replacedDescription = description
  .replace('(name)', all_details[0].name)
  .replace('(designation)', all_details[0].designation)
  .replace('(date)', all_details[0].date)
  .replace('(shifts)', all_details[0].shifts)
  .replace('(period)', all_details[0].period)
  .replace('(ctc)', all_details[0].ctc)
  .replace('(stamp)', appoint_result[0].stamp); // Assuming stamp is a field in appoint_result

        return res.status(200).json({
            status_code: "1",
            status:"success",
            message:"Offer Letter generated",
            data: replacedDescription
        });
    } catch (error) {
    console.error(error);
    return res.status(500).json({
      status_code: "2",
      status: "failed",
      message: "Internal Server Error",
    });
    }
    finally
    {
        connection.release()
    }
})
router.post('/set-my-salary-account', requireStaffLogin, async (req, res) => {
    
    const { bank_name, ifsc_code, acc_no, ac_holder_name, mobile, branch } = req.body;
    const employee = req.staff;
    const connection = await poolPromise().getConnection();
    try {
        
    
            
        //     const [staff_result] = await connection.query("SELECT * FROM staff_data WHERE unique_id = ? ", [employee.unique_id]);
        
        
        // if (staff_result.length === 0)
        // {
        //     return res.status(422).json({
        //         status_code: "2",
        //         status: "failed",
        //         message: "Employee Does not Exist" 
        //     });
        // }
        
        const [emp_bank_result] = await connection.query("SELECT * FROM emp_bank_ac WHERE unique_id = ? and status = ?", [req.staff.unique_id, "Enable"]);
        if (emp_bank_result.length > 0)
        {
            return res.status(422).json({
                status_code: "2",
                status: "failed",
                message: "Data Already Available" 
            });
        }
        const [benificiary_result] = await connection.query("SELECT MAX(beneficiary_id) AS max_beneficiary_id FROM emp_bank_ac");
        let maxBeneficiaryId = benificiary_result[0].max_beneficiary_id
        if (maxBeneficiaryId === null) {
            maxBeneficiaryId = 10000;
        }
        maxBeneficiaryId += 1;
        try
        {
            await connection.query("INSERT INTO emp_bank_ac SET ?", {
                unique_id: req.staff.unique_id,
                emp_id: req.staff.emp_id,
                bank_name,
                ifsc_code,
                acc_no,
                ac_holder_name,
                mobile,
                branch,
                beneficiary_id:maxBeneficiaryId ,
                status:"Enable"
            })

            return res.status(422).json({
                status_code: "1",
                status: "status",
                message: "Bank Account Details Setted Successfully" 
            });
        }
        catch (error)
        {
            console.log(error);
        }
    } catch (error) {
        return res.status(422).json({
            status_code: "2",
            status: "failed",
            message: "Internal Server Error" 
        });
    }
    
    finally
    {
        connection.release()
    }
})
router.get('/fetch-my-account', requireStaffLogin, async (req, res) => {
    
    const employee = req.staff;
    const connection = await poolPromise().getConnection();
    try {
        
    
            
        //     const [staff_result] = await connection.query("SELECT * FROM staff_data WHERE unique_id = ? ", [employee.unique_id]);
        
        
        // if (staff_result.length === 0)
        // {
        //     return res.status(422).json({
        //         status_code: "2",
        //         status: "failed",
        //         message: "Employee Does not Exist" 
        //     });
        // }
        
        const [emp_bank_result] = await connection.query("SELECT * FROM emp_bank_ac WHERE unique_id = ? and status = ?", [req.staff.unique_id, "Enable"]);
        if (emp_bank_result.length === 0)
        {
            return res.status(422).json({
                status_code: "2",
                status: "failed",
                message: "Unable to find account" 
            });
        }
        return res.status(200).json({
            status_code: "1",
            status: "success",
            message: emp_bank_result[0]
        });
        
    } catch (error) {
        return res.status(422).json({
            status_code: "2",
            status: "failed",
            message: "Internal Server Error" 
        });
    }
    
    finally
    {
        connection.release()
    }
})
router.post('/de-register-account', requireStaffLogin, async (req, res) => {
    
    const { beneficiary_id } = req.body;
    const employee = req.staff;
    const connection = await poolPromise().getConnection();
    try {
        
    
            
        //     const [staff_result] = await connection.query("SELECT * FROM staff_data WHERE unique_id = ? ", [employee.unique_id]);
        
        
        // if (staff_result.length === 0)
        // {
        //     return res.status(422).json({
        //         status_code: "2",
        //         status: "failed",
        //         message: "Employee Does not Exist" 
        //     });
        // }
        
        const [emp_bank_result] = await connection.query("SELECT * FROM emp_bank_ac WHERE beneficiary_id = ? and status = ?", [beneficiary_id, "Enable"]);
        if (emp_bank_result.length === 0)
        {
            return res.status(422).json({
                status_code: "2",
                status: "failed",
                message: `Unable to find account with benificiary_id ${beneficiary_id} `
            });
        }

        try
        {
            await connection.query("UPDATE emp_bank_ac SET  status = ? where beneficiary_id = ?", ["Disable",beneficiary_id])

            return res.status(422).json({
                status_code: "1",
                status: "status",
                message: "Bank Account De-Registered" 
            });
        }
        catch (error)
        {
            console.log(error);
        }
    } catch (error) {
        return res.status(422).json({
            status_code: "2",
            status: "failed",
            message: "Internal Server Error" 
        });
    }
    
    finally
    {
        connection.release()
    }
})

router.post('/change-password', requireStaffLogin, async (req, res) => {
    const { old_password, new_password } = req.body;
    const connection = await poolPromise().getConnection();
    try {
        const [staff_result] = await connection.query("SELECT * FROM staff_data where unique_id = ? and password = ?", [req.staff.unique_id, old_password]);
        // console.log(`Password ${old_password} db_password = ${staff_result[0].password}  hashedPassword = ${await hashOtp("Admin123*")}`)
        // return res.json({data:"v"})
        if (staff_result.length === 0)
        {
            return res.status(422).json({
                status_code: "2",
                status: "failed",
                message: "Incorrect Password submitted" 
            });
        }
        try {
            
            await connection.query(`UPDATE staff_data SET password = ? WHERE unique_id = ? `, [new_password, req.staff.unique_id]);
            return res.status(422).json({
                status_code: "1",
                status: "success",
                message: "Password Updated Successfully" 
            });
        } catch (error) {
            console.log(error)
        }
    } catch (error) {
        return res.status(422).json({
            status_code: "2",
            status: "failed",
            message: "Internal Server Error" 
        });
    }
    
    finally
    {
        connection.release()
    }
    
})
router.post('/attendance-log/:emp_id', requireStaffLogin, async (req, res) => { 
    const emp_id = req.params.emp_id;
    const {from_date, to_date} = req.body
    // return res.json({emp_id})
    if (req.staff.designation_id !== '001')
    {
        return res.status(500).json({
            status_code: "2",
            status: "failed",
            message: `You are not authorized to view attendance-log for others`,
          });
    }

    const connection = await poolPromise().getConnection();
    try
    {
        const [staff_result] = await connection.query("SELECT * FROM staff_data WHERE emp_id = ? ", [emp_id])
        // return res.json({staff_result})
        if (staff_result.length === 0)
        {
            return res.status(500).json({
                status_code: "2",
                status: "failed",
                message: `You are not authorized to view attendance-log for ${emp_id}`,
              });
            }
            const query = `
            SELECT
            unique_id,
            DATE_FORMAT(date, '%Y-%m-%d') AS log_date,
            MIN(CASE WHEN type = 'IN' THEN time END) AS in_time,
            CASE
                WHEN SUM(CASE WHEN type = 'OUT' THEN 1 ELSE 0 END) > 0
                THEN MAX(CASE WHEN type = 'OUT' THEN time END)
                ELSE NULL
            END AS out_time,
            coordinates
        FROM
            attendance
        WHERE
            unique_id = ?
            AND date >= ?
            AND date <= ?
        GROUP BY
            unique_id,
            log_date`;
    
  
    const [attendanceResult] = await connection.query(query, [staff_result[0].unique_id,from_date,to_date]);
// return res.json({staff_result,attendanceResult})
    const convertedResult = await Promise.all(attendanceResult.map(async (item) => {
        let location = {};
        try {
          if (item.coordinates !== null) {
            const [geo_result] = await connection.query("SELECT * FROM geolocation WHERE coordinates = ? ", [item.coordinates]);
            if (geo_result.length !== 0) {
              location = {
                district: geo_result[0].district,
                pincode: geo_result[0].pincode,
                state: geo_result[0].state
              };
            }
          }
        } catch (error) {
          console.log(`Getting geolocation ${error}`);
        }
        const checkin = {
          "date&time": item.in_time ? `${item.log_date} ${item.in_time}` : "",
          "location": location
        };
        const checkout = {
          "date&time": item.out_time ? `${item.log_date} ${item.out_time}` : "",
          "location": location
        };
        return [{"checkin": checkin}, {"checkout": checkout}];
      }));
// return res.json({convertedResult})
// Initialize an empty object to store the formatted data
// let formattedData = {};

// // Iterate over the result set
// for (let i = 0; i < attendance_result.length; i++) {
//     let row = attendance_result[i];

//     // Check if the current row is an IN entry and has not been processed yet for the day
//     if (row.type === 'IN' && !formattedData[row.date]) {
//         formattedData[row.date] = {
//             "checkin": {
//                 "date&time": `${row.date.toDateString()} ${row.time}`,
//                 "location": row.coordinates
//             }
//         };

//         // Check if there is a corresponding OUT entry for the current day
//         let nextRow = attendance_result[i + 1];
//         if (nextRow && nextRow.type === 'OUT' && nextRow.date === row.date) {
//             formattedData[row.date]["checkout"] = {
//                 "date&time": `${nextRow.date.toDateString()} ${nextRow.time}`,
//                 "location": nextRow.coordinates
//             };
//             // Skip the next row as it has been processed
//             i++;
//         } else {
//             // If no check-out data found, include check-in data only
//             formattedData[row.date]["checkout"] = {
//                 "date&time": "No Check-Out Data",
//                 "location": ""
//             };
//         }
//     }
// }

// Convert the formattedData object to an array of objects
// const finalData = Object.values(formattedData);


  // Send the JSON response
    return res.status(200).json({
        status_code: "1",
        status: "success",
        data:convertedResult.length === 0 ? 'No attendance Log': convertedResult
  });
  
} catch (error)
{
    console.log(error);
    return res.status(500).json({
        status_code: "2",
        status: "failed",
        message: "Internal Server Error",
      });
    }
    finally
{
    connection.release()
    }
})
router.post('/attendance-log', requireStaffLogin, async (req, res) => { 
    const connection = await poolPromise().getConnection();
    try
    {
    const {from_date, to_date} = req.body
    const query = `
    SELECT
    unique_id,
    DATE_FORMAT(date, '%Y-%m-%d') AS log_date,
    MIN(CASE WHEN type = 'IN' THEN time END) AS in_time,
    CASE
        WHEN SUM(CASE WHEN type = 'OUT' THEN 1 ELSE 0 END) > 0
        THEN MAX(CASE WHEN type = 'OUT' THEN time END)
        ELSE NULL
    END AS out_time,
    coordinates
FROM
    attendance
WHERE
    unique_id = ?
    AND date >= ?
    AND date <= ?
GROUP BY
    unique_id,
    log_date`;
    
  
    const [attendanceResult] = await connection.query(query, [req.staff.unique_id,from_date,to_date]);
    // return res.json({attendanceResult})
    const convertedResult = await Promise.all(attendanceResult.map(async (item) => {
        let location = {};
        try {
          if (item.coordinates !== null) {
            const [geo_result] = await connection.query("SELECT * FROM geolocation WHERE coordinates = ? ", [item.coordinates]);
            if (geo_result.length !== 0) {
              location = {
                district: geo_result[0].district,
                pincode: geo_result[0].pincode,
                state: geo_result[0].state
              };
            }
          }
        } catch (error) {
          console.log(`Getting geolocation ${error}`);
        }
        const checkin = {
          "date&time": item.in_time ? `${item.log_date} ${item.in_time}` : "",
          "location": location
        };
        const checkout = {
          "date&time": item.out_time ? `${item.log_date} ${item.out_time}` : "",
          "location": location
        };
        return [{"checkin": checkin}, {"checkout": checkout}];
      }));
// return res.json({convertedResult})
// // Initialize an empty object to store the formatted data
// let formattedData = {};

// // Iterate over the result set
// for (let i = 0; i < attendance_result.length; i++) {
//     let row = attendance_result[i];

//     // Check if the current row is an IN entry and has not been processed yet for the day
//     if (row.type === 'IN' && !formattedData[row.date]) {
//         formattedData[row.date] = {
//             "checkin": {
//                 "date&time": `${row.date.toDateString()} ${row.time}`,
//                 "location": row.coordinates
//             }
//         };

//         // Check if there is a corresponding OUT entry for the current day
//         let nextRow = attendance_result[i + 1];
//         if (nextRow && nextRow.type === 'OUT' && nextRow.date === row.date) {
//             formattedData[row.date]["checkout"] = {
//                 "date&time": `${nextRow.date.toDateString()} ${nextRow.time}`,
//                 "location": nextRow.coordinates
//             };
//             // Skip the next row as it has been processed
//             i++;
//         } else {
//             // If no check-out data found, include check-in data only
//             formattedData[row.date]["checkout"] = {
//                 "date&time": "No Check-Out Data",
//                 "location": ""
//             };
//         }
//     }
// }

// // Convert the formattedData object to an array of objects
// const finalData = Object.values(formattedData);


  // Send the JSON response
    return res.status(200).json({
        status_code: "1",
        status: "success",
        data:convertedResult.length === 0 ? 'No attendance Log': convertedResult
  });
  
} catch (error)
{
    console.log(error);
    return res.status(500).json({
        status_code: "2",
        status: "failed",
        message: "Internal Server Error",
      });
    }
    finally
{
    connection.release()
    }
})


var pin_code = async (pincode) => {

    const connection = await poolPromise().getConnection();
    console.log(pincode, "pincode")
    
    try {
        const sql = "SELECT * FROM area WHERE pincode = ?";
        const value = [pincode];
        const [area] = await connection.query(sql, value);

        if (area.length === 0) {
            return axios
                .get("https://api.postalpincode.in/pincode/" + pincode)
                .then(async (response) => {
                    const [data] = response.data;
                    // console.log(data);
                    if (data) {
                        let arr = data.PostOffice || null;
                        // console.log({ arr });
                        if (arr === null) {
                            const sql1 = "SELECT * FROM area_data WHERE pincode = ?";
                            const value1 = [pincode];
                            const [area] = await connection.query(sql1, value1);
                            data = area.map(({
                                name,
                                district,
                                division,
                                state
                            }) => ({
                                area_name: name,
                                division,
                                district,
                                state,
                                pincode
                            }))
                            console.log(data);
                            return data;
                        }
                        let sql = `INSERT INTO area (
               name,
               district,
               division,
               state,
               pincode
               
             )
             VALUES `;

                        sql += arr
                            .map((postOffice) => {
                                return `("${postOffice.Name}", "${postOffice.District}", "${postOffice.Division}", "${postOffice.State}", "${postOffice.Pincode}")`;
                            })
                            .join(", ");

                        await connection.query(sql);

                        console.log("data saved", arr);
                        data = await arr.map(({
                            Name,
                            District,
                            Division,
                            State
                        }) => ({
                            area_name: Name,
                            division: Division,
                            district: District,
                            state: State,
                            pincode
                        }))
                        return data
                    }
                })
                .catch(async (error) => {
                    // console.log(error);
                    const sql1 = "SELECT * FROM area_data WHERE pincode = ?";
                    const value1 = [pincode];
                    const [area] = await connection.query(sql1, value1);
                    data = area.map(({
                        name,
                        district,
                        division,
                        state
                    }) => ({
                        area_name: name,
                        division,
                        district,
                        state,
                        pincode
                    }))
                    return data
                });
        } else {
            data = area.map(({
                name,
                district,
                division,
                state
            }) => ({
                area_name: name,
                division,
                district,
                state,
                pincode
            }))
            return data
        }
    } catch (err) {
        console.log("error", err);
    } finally {
        await connection.release();
    }
}

// Function to call Third-Party Eko Onboard User API
async function callEkoOnboardAPI(userData) {
    // Implement logic to call Eko Onboard User API and return the response
    // Example: const response = await thirdPartyApiClient.post('/eko/onboard', userData);
    // Replace the above line with actual API call
    return {
        status: 0
    }; // Example response, modify as per your API response structure
}

//Customer Services Point & Merchant Registered  end
module.exports = router;