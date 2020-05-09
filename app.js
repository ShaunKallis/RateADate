
//@TODO: add avg on search page

const request = require("request");
var cookieParser = require('cookie-parser');

const express = require("express");
const app = express();
const session = require('express-session');
const crypto = require('crypto');
const multer = require('multer');
const scrypt = require('scrypt');

const Identicon = require('identicon.js');

const MongoClient = require('mongodb').MongoClient;
const ObjectId = require('mongodb').ObjectId;

const uri = "mongodb+srv://mRidge:duzSEpQQh4fTIqSm@cluster0-2dcbj.mongodb.net/test?retryWrites=true&w=majority";
const database_name = "RateADate";
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
client.connect();

app.use(cookieParser());

app.use(express.static(__dirname + '/public/'));

app.set("view engine", "ejs");
app.use(express.json()) // use json middleware
app.use(express.static("public")); //folder for images, css, js
app.use(express.urlencoded()); // used to parse data sent using the POST method
// Recall all middleware for app.use executes every time before routes

app.use(session({
    secret: 'keyboard cat',
    cookie: { maxAge: 6000000 }
}))

app.use(myMiddleware);
function myMiddleware(req, res, next) {
    console.log(new Date());
    next(); // passes control to back to server to do the next thing.
}

// multer storage
let storage = multer.memoryStorage();
let upload = multer({ storage: storage });

app.post('/cdn/avatars', isUserAuthenticated, upload.single('avatar'), async function (req, res, next) {
    const file = req.file
    if (!file) {
        const error = new Error('Please upload a file');
        error.httpStatusCode = 400;
        return next(error);
    }

    let avatar_id = await store_avatar(req.session.name, file.buffer);
    res.send(JSON.stringify({ "avatar_id": avatar_id }));

})

app.get('/cdn/avatars/:username.png', async function (req, res, next) {
    let username = req.params.username;
    let user_obj = await getUser(username);

    if (!user_obj) {
        const error = new Error('Not Found');
        error.httpStatusCode = 404;
        return next(error);
    }

    let avatar_id = user_obj.profile.avatar_id;

    let avatar = await get_avatar(username, avatar_id, user_obj._id.toString());

    res.setHeader('Content-Type', 'image/png');
    res.end(avatar);
})

app.get('/cdn/avatars/:username/default.png', async function (req, res, next) {
    let username = req.params.username;
    let user_obj = await getUser(username);

    if (!user_obj) {
        const error = new Error('Not Found');
        error.httpStatusCode = 404;
        return next(error);
    }

    res.setHeader('Content-Type', 'image/png');
    res.end(get_user_identicon(user_obj._id.toString()));
})

async function store_avatar(username, buffer) {
    let payload = {
        "username": username,
        "file": buffer,
    }

    let result = await client.db(database_name).collection("avatars").insertOne(payload);
    return result.ops[0]._id;
}

async function get_avatar(username, avatar_id, user_id) {
    if (avatar_id == null) {
        return get_user_identicon(user_id);
    }
    let result = await client.db(database_name).collection("avatars").findOne({
        "username": username, "_id": ObjectId(avatar_id)
    });

    if (result == null) {
        return get_user_identicon(user_id);
    }
    return result.file.buffer;
}

function isAdminAuthenticated(req, res, next) {
    if (!req.session.adminAuthenticated) {
        res.redirect('/adminLogin');
    } else {
        next();
    }
}

function isUserAuthenticated(req, res, next) {
    if (!req.session.userAuthenticated) {
        res.redirect('/userLogin');
    } else {
        next();
    }
}

async function userLoginAttempt(username, password) {
    var result = await client.db(database_name).collection("users").findOne({
        "username": username
    });

    console.log(`user found: ${result}`);
    if (result == null) {
        return false;
    }

    let password_salt = result.password_salt;
    let new_hash = hash_password(password, password_salt);

    if (new_hash != result.password_hash) {
        return false;
    }

    return true;

}

async function adminLoginAttempt(username, password) {
    var result = await client.db(database_name).collection("users").findOne({
        "username": username,
        "password": password,
        "admin": true
    });
    console.log(`admin found: ${result}`);
    if (result != null) {
        return true;
    } else {
        return false;
    }
}

//routes
app.get("/", function (req, res) {
    if (req.session.userAuthenticated) {
        let userProf = getUser(req.session.name);
        res.redirect("/profile");
    }
    else {
        res.render("index");
    }

});
app.get("/userLogin", async function (req, res) {
    res.render("userLogin");
});
app.get("/adminLogin", async function (req, res) {
    res.render("adminLogin");
});

app.get("/guidelines", async function (req, res) {
    res.render("guidelines");
});


// from lab 10, admin side of page
app.get("/admin", isAdminAuthenticated, async function (req, res) {
    if (req.session.adminAuthenticated) {
        let productList = await getProductList();
        res.render("admin", { "productList": productList });
    } else {                         //if user hasn't authenticated
        res.render("adminLogin");                  //send them to the login screen
    }
});

app.post("/adminLoginProcess", function (req, res) {
    adminLoginAttempt(req.body.username, req.body.password).then(result => {
        console.log(`result of login attempt: ${result}`);
        if (result == true) {
            req.session.adminAuthenticated = true;
            res.send({ "loginSuccess": true });
        } else {
            res.send(false);
        }
    });
});

app.post("/userLoginProcess", function (req, res) {
    userLoginAttempt(req.body.username, req.body.password).then(result => {
        console.log(`result of login attempt: ${result}`);
        if (result == true) {
            console.log(req.body.username);
            req.session.name = req.body.username;
            console.log(req.session.name);
            req.session.userAuthenticated = true;
            res.send({ "loginSuccess": true });
        } else {
            res.send(false);
        }
    });
});

//Johnny Cookie Functions
function setCookie(name, value, days) {
    var expires = "";
    if (days) {
        var date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        expires = "; expires=" + date.toUTCString();
    }
    document.cookie = name + "=" + (value || "") + expires + "; path=/";
}
function getCookie(name) {
    var nameEQ = name + "=";
    var ca = document.cookie.split(';');
    for (var i = 0; i < ca.length; i++) {
        var c = ca[i];
        while (c.charAt(0) == ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
}
function eraseCookie(name) {
    document.cookie = name + '=; Max-Age=-99999999;';
}

app.get("/logout", function (req, res) {
    req.session.destroy();
    res.redirect("/");   //taking user back to login screen
});

app.get("/adminStats", isAdminAuthenticated, function (req, res) {

    res.render("adminStatistics");

});


// FUNCTIONS

function hash_password(password, salt) {
    let params = { "N": 16, "r": 1, "p": 1 };
    let length = 64;
    return scrypt.hashSync(password, params, length, salt).toString("base64");
}


async function insertProduct(body) {
    if (await client.db("pokemondb").collection("pokemon").findOne({ name: { $regex: new RegExp(body.name, "i") } })) {
        console.log(`${body.name} already in database`);
        return false;
    } else {
        const result = await client.db("pokemondb").collection("pokemon").insertOne(body);
        console.log(`${body.name} inserted in database`);
        return true;
    }
}

async function getProductList() {
    const result = await client.db("RateADate").collection("users").find().toArray();
    return result;
}

async function createUser(username, password, email, bio, reviews) {
    console.log(`createUser called`);
    let result = await client.db("RateADate").collection("users").findOne({ "username": username });
    if (result != null) {
        // do something to signify error creating account
        console.log(`user found with username: ${username}`);
    } else {
        let password_salt = crypto.randomBytes(128).toString("base64");
        // console.log(`salt generated: ${password_salt}`);
        let password_hash = hash_password(password, password_salt);

        result = await client.db(database_name).collection("users").insertOne({
            "username": username,
            "password_hash": password_hash,
            "password_salt": password_salt,
            "email": email,
            "profile": {
                "firstname": null,
                "lastname": null,
                "bio": null,
                "avatar_id": null
            }
        });
        console.log(`user created with username: ${username}`);
    }
    return result;
}

async function addReview(byUsername, username, rating, textReview) {
    console.log(byUsername + " " + username + " " + rating + " " + textReview);
    var dateFormat = require('dateformat');
    var now = new Date();
    var format = dateFormat(now, "mmmm dS, yyyy");
    var result = await client.db("RateADate").collection("reviews").updateOne(
        {
            "by": byUsername,
            "for": username

        },
        {
            $set: {
                "by": byUsername,
                "for": username,
                "rating": rating,
                "text": textReview,
                "dateAdded": format

            },
        }, { upsert: true });
}

async function getReviews(username) {
    const result = await client.db("RateADate").collection("users").find({ "name": username }).toArray();
    return result;
}

function get_user_identicon(user_id) {
    let ret = new Identicon(user_id, 480).toString();
    ret = new Buffer.from(ret, 'base64');
    return ret;
}

app.get("/searchPerson", isUserAuthenticated, async function (req, res) {

    //   let categories = await getCategories();
    //console.log(categories);
    //   res.render("searchProduct", {"categories":categories});
    res.render("searchPerson");

});

// from lab 9 user side of page
app.get("/users", isUserAuthenticated, async function (req, res) {
    let rows = await getProduct(req.query.keyword);

    res.render("users", { 
        "records": rows,
        
    });

});//product

app.get("/reviews/:id", async function (req, res) {
    var cUser = req.params.id;
    let rows = await getReviews(cUser);
    
    const userProf = await client.db("RateADate").collection("users").findOne({ username: cUser });
    let reviews = await getReviewsFor(cUser);

    res.render("reviews", {
        "userProf": userProf,
        "reviews": reviews,
        "records": rows,
    });

});//productDetails

//Route for User Profile Page
app.get("/profile", async function (req, res) {
    //var cUser = req.cookie.cookieUser;
    var cUser = req.session.name;
    // console.log(cUser);
    const userProf = await getUser(cUser);
    // console.log(userProf);
    res.render("profilePage", { "userProf": userProf })
})

//Route for User Profile Edit Page
app.get("/profile/edit", async function (req, res) {
    var cUser = req.session.name;
    const userProf = await getUser(cUser);

    res.render("profileEdit",
        {
            "userProf": userProf,
        })
})

//Route for User Profile Page
app.get("/reviews", async function (req, res) {
    //var cUser = req.cookie.cookieUser;
    var cUser = req.session.name;
    let rows = await getReviews(cUser);
    const userProf = await client.db("RateADate").collection("users").findOne({ username: cUser });
    // console.log("userProf: ", userProf);
    // console.log("data from userProf: ", userProf.reviews);
    let reviews = await getReviewsFor(cUser);

    res.render("reviews", {
        "userProf": userProf,
        "reviews": reviews,
        "records": rows,
    })
})

app.post("/addreview", isUserAuthenticated, async function (req, res) {
    const newReview = req.body;
    console.log("review: ", newReview);
    let rows = await (addReview(req.session.name, newReview.username, newReview.rating, newReview.textReview));
});

//Create Account POST
app.post("/index", function (req, res) {
    //Add data from form into, DB
    var tempName = req.body.username;
    var tempPass = req.body.password;
    var tempEmail = req.body.email;

    createUser(tempName, tempPass, tempEmail)
    //Redirect to Main Page
    res.redirect("/")
})

//Create Account Route
app.get("/createAccount", function (req, res) {
    res.render("createAccount.ejs")
})

app.get("/productInfo", isUserAuthenticated, async function (req, res) {

    let rows = await getProduct(req.query.productID);
    //res.render("products", {"records":rows});
    res.send(rows)
});//product

async function getProduct(name) {
    var result;
    if (name == '') {
        result = await client.db("RateADate").collection("users").find().toArray();
    } else {
        result = await client.db("RateADate").collection("users").find({ username: name }).toArray();
    }

    console.log(result);
    return result;
}//getproduct

async function getUser(username) {
    let user = await client.db(database_name).collection("users").findOne({ username: username });

    if (!user) {
        return null;
    }

    return user;
}

async function getReviewsFor(username) {
    let result = await client.db(database_name).collection("reviews").find({ "for": username }).toArray();
    return result;
}

async function getReviewsBy(username) {
    let result = await client.db(database_name).collection("reviews").find({ "by": username }).toArray();
    return result;
}

app.get("/api/reviews", async function (req, res) {
    let result = await getReviewsFor(req.body.username);

    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(result));
})

async function setReview(user_for, user_by, rating, text) {
    let review = await client.db(database_name).collection("reviews").findOne({ "for": user_for, "by": user_by });
    let review_exists = true;

    if (!review) {
        review_exists = false;
        review = {};
    }
    var dateFormat = require('dateformat');
    var now = new Date();
    var format = dateFormat(now, "mmmm dS, yyyy");

    review.rating = rating;
    review.text = text;
    review.dateAdded = format;

    if (review_exists) {
        review = await client.db(database_name).collection("reviews").updateOne(
            { "for": user_for, "by": user_by },
            {
                $set: review,
                $setOnInsert: { dateAdded: new Date() }
            });
    } else {
        review = await client.db(database_name).collection("reviews").insertOne(review);
    }

    return review;

}

async function setProfile(username, firstname, lastname, bio, avatar_id) {
    let user = await client.db(database_name).collection("users").findOne({ "username": username });
    if (!user) {
        return;
    }

    profile = {}

    profile.firstname = firstname;
    profile.lastname = lastname;
    profile.bio = bio;
    profile.avatar_id = avatar_id;

    profile = await client.db(database_name).collection("users").updateOne(
        { "username": username },
        {
            $set: { "profile": profile }
        });
    return profile;
}



app.post("/setreview_debug", async function (req, res) {
    let result = await setReview(req.body.for, req.body.by, req.body.rating, req.body.text);

    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(result));
})

app.post("/setprofile", isUserAuthenticated, async function (req, res) {
    const new_profile = req.body;
    let result = await setProfile(req.session.name, new_profile.firstname, new_profile.lastname, new_profile.bio, new_profile.avatar_id);

    let resp = result != null ? { "success": 200 } : { "error": 500 };

    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(resp));
});

//starting server
app.listen(process.env.PORT, process.env.IP, function () {
    console.log(`Express server is running on ${process.env.IP}:${process.env.PORT}...`);
})