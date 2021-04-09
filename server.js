const express = require("express");
const app = express();
const bp = require("body-parser");
const mysql = require("mysql2");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
var cors = require("cors");
const env = require("dotenv").config();
const router = express.Router();
const path = require("path");
app.use(cors());
app.use("/", router);
router.use(bp.json());
router.use(bp.urlencoded({ extended: true }));

//connect to database
var connection = mysql.createConnection({
  host: process.env.db_host,
  user: process.env.db_username,
  password: process.env.db_password,
  database: process.env.name,
});
connection.connect((err) => {
  if (err) throw err;
  console.log("connected to " + process.env.db_name);
});
/**
 * check user is login or not. if user already login, then
 * will go to profile page.
 */
const ifLogin = (req, res, next) => {
  try {
    const token = req.get("Cookie").split("token=")[1].trim();
    const user = jwt.verify(token, "SECRETKEY");
    console.log(user);
    return res.redirect("/profile");
  } catch (error) {
    next();
  }
};
router.get("/", (req,res)=>{
  return res.sendFile(path.join(__dirname + "/views/home.html"));
})
//request to register
router.get("/register",ifLogin, (req, res) => {
  return res.sendFile(path.join(__dirname + "/views/register.html"));
});
router.post("/postregister", (req, res) => {
  console.log(req.body);
  const ufname = req.body.ufname;
  const ulname = req.body.ulname;
  const username = req.body.username;
  const password = req.body.password;
  if (!ufname || !ulname || !username || !password) {
    return res.send({
      err: false,
      msg: "Please fill all firstname ,lastname, username, password",
    });
  }
  const hash = bcrypt.hashSync(password, 12);
  let new_user = {
    ufname: req.body.ufname,
    ulname: req.body.ulname,
    username: req.body.username,
    password: hash,
    email: req.body.email,
    age: req.body.age,
    address: req.body.address,
    role: "user",
  };
  connection.query(
    "INSERT INTO shop_db.user SET ?",
    new_user,
    (error, result) => {
      if (error) {
        console.log(error);
        if (error.errno == 1062) {
          return res.send({
            data: {
              err: true,
              msg: "This user name already used.",
            },
          });
        }
      } else {
        const token = jwt.sign(
          {
            username: new_user.username,
            loginStatus: true,
            role: new_user.role,
          },
          "SECRETKEY",
          { expiresIn: 60 * 1 }
        );
        res.setHeader("Set-Cookie", "token=" + token);
        return res.send({
          data: {
            err: true,
            msg: "Now you are member.<a href='/profile'>profile </a>",
          },
        });
      }
    }
  );
});

//request to login
router.get("/login", ifLogin, (req, res) => {
  return res.sendFile(path.join(__dirname + "/views/login.html"));
});
router.post("/postlogin", (req, res, next) => {
  var username = req.body.username;
  var password = req.body.password;
  if (!username || !password)
    return res.send({
      data: {
        err: true,
        msg: "Invlid username or password",
      },
    });
  connection.query(
    "SELECT password, role FROM shop_db.user WHERE username = ?",
    [username],
    (error, results) => {
      if (error) throw error;
      if (results.length == 0)
        return res.send({
          data: { error: true, msg: "username does not exit" },
        });
      else {
        bcrypt.compare(password, results[0].password).then((bcy_result) => {
          if (!bcy_result)
            return res.send({
              data: {
                err: true,
                msg: "Password isn't correct",
                loginStatus: false,
                username: username,
              },
            });
          //else
          var role = results[0].role;
          const token = jwt.sign(
            { username: username, loginStatus: true, role: role },
            "SECRETKEY",
            { expiresIn: 60 * 1 }
          );
          res.setHeader("Set-Cookie", "token=" + token);
          res.send({
            data: {
              err: true,
              msg: "Now you can visit <a href='/profile'>profile </a>",
            },
          });
        });
      }
    }
  );
});
//request to get information of user
router.get("/profile", (req, res) => {
  try {
    const token = req.get("Cookie").split("token=")[1].trim();
    const user = jwt.verify(token, "SECRETKEY");
    if (user.loginStatus == true) {
      return res.sendFile(path.join(__dirname + "/views/profile.html"));
    }
  } catch (error) {
    return res.redirect("/login");
  }
  
});
router.get("/getloginstatus", (req, res, next) => {
  console.log("request login status");
  try {
    const token = req.get("Cookie").split("token=")[1].trim();
    const user = jwt.verify(token, "SECRETKEY");
    if (user.loginStatus == true) {
      return res.send({
        data: {
          err: false,
          loginStatus: user.loginStatus,
          username: user.username,
          role: user.role,
        },
      });
    }
  } catch (error) {
    console.log("not login yet");
    return res.send({
      data: {
        err: true,
        loginStatus: false,
        msg : 'please login first'
      },
    });
  }
});
//request to log out
router.get("/logout", (req, res) => {
  res.clearCookie("token");
  return res.redirect("/");
});

/***
 * request search product
 *  -if you want to search all, /results/none/none/none
 *  -if you want to search by name only, /results/{name}/none/none
 *  -if you want to search by name with sort by price, /results/{name}/{ASC or DESC}/none
 *  -if you want to search by name with sort by price and type, /results/{name}/{ASC or DESC}/{cassette or vinyl or film} ** you can select more than 1 type.
 */
/**
 * TEST CAST for SEARCH PRODUCT
 * METHOD GET 
 *  -search all
 *    url : localhost:3030/results/none/none/none
 *  -search by name
 *    url : localhost:3030/results/kodak/none/none
 *  -search by name and sort low to high price.
 *    url : localhost:3030/results/fuji/asc/none
 *  -search by name and type
 *    url : localhost:3030/results/fuji/none/film
 */
 router.get("/results/:name/:sortByPrice/:type",(req,res)=>{
  var name = (req.params.name === "none")? "":req.params.name;
  var sortByPrice = (req.params.sortByPrice === "none")? "":req.params.sortByPrice;
  var type = (req.params.type === "none")? "":req.params.type;
  console.log(name,sortByPrice,type);
  if(sortByPrice !== "") sortByPrice = `ORDER BY price ${sortByPrice}`;
  if(type !== "") type =  `and type IN (${type})`; 
  var sql = `SELECT * FROM shop_db.product WHERE pName LIKE '%${name}%' ${type} ${sortByPrice}`; 
  console.log(sql);
  connection.query(sql, (error, results, fields) => {
      if (error) {
        res.send({
          data: {
            err: true,
            msg: "Error occur",
          },
        });
        throw error;
      }
      console.log(results.length + " rows returned");
      return res.send({
        err: false,
        msg: `lists[${results.length} rows].`,
        data: results,
      });
    }
  );
});


/**
 * ADMIN SERVICE START
 * only admin role can visit.
 */

//request to view stock (only admin)
router.get("/stock", (req, res) => {
  //console.log("stock");
  try {
    const token = req.get("Cookie").split("token=")[1].trim();
    const user = jwt.verify(token, "SECRETKEY");
    if (user.loginStatus == true) {
      if (user.role == "admin") {
        return res.sendFile(path.join(__dirname + "/views/stock.html"));
      } else {
        return res.send("You are not admin <a href='/'>home</a>");
      }
    }
  } catch (error) {
    return res.redirect("/login");
  }
});
//request to view usermanage (only admin)
router.get("/usermanage",(req,res)=>{
  return res.sendFile(path.join(__dirname+"/views/usrmanage.html"));
})
/**
 * TEST CASE for INSERT PRODUCT
 * METHOD POST
 * url : localhost:3030/insertproducts
 * body : json
* {
      "pName" : "Hikari",
      "price" : "250",
      "detail" : "none",
      "Image" : "https://github.com/itsmebabysmiley/Online-shopping/blob/main/image/products/Vinyl1.png?raw=true",
      "type" : "vinyl"
  } 
  {
    "pName" : "Leave the Door Open",
    "price" : "450",
    "detail" : "The official music video for Bruno Mars, Anderson .Paak, Silk Sonic's new single 'Leave the Door Open'",
    "Image" : "https://github.com/itsmebabysmiley/Online-shopping/blob/main/image/products/Vinyl2.png?raw=true",
    "type" : "vinyl"
  }
 */ 
//request insert product
router.post("/insertproducts", (req, res) => {
  //console.log(req.body);
  var products = req.body;
  if(!products.pName, !products.price, !products.type){
    return res.send({
      data: {
        err: true,
        msg: "Please insert all name, price ,and type"
      }});
  }
  connection.query(
    "INSERT INTO shop_db.product SET ?",
    products,
    (error, results, fields) => {
      if (error) {
        return res.send({ data: { err: true, msg: "Error occur" } });
      }
      return res.send({ data: { err: false, msg: `product ${products.pName} has been added`} });
    }
  );
});
/***
 * TEST CASE for DELETE PRODUCT
 * METHOD DELETE
 * url : localhost:3030/deleteproducts
 * body : json
 * {
    "pId" : "1"
    }
    {
    "pId" : "10"
    }
 */
//request delete product
router.delete("/deleteproducts", (req, res) => {
  var pId = req.body.pId;
  connection.query(
    `DELETE FROM shop_db.product WHERE pId = ?`,
    [pId],
    (error, results) => {
      if (error) {
        return res.send({ data: { err: true, msg: "Error occur" } });
      }
      return res.send({ data: { err: false, msg: `product ${pId} has been deleted`} });
    }
  );
});
/***
 * TEST CASE for UPDATE PRODUCT
 * METHOD PUT
 * url : localhost:3030/updateproducts
 * body : json
 *  {
      "price" : "320",
      "pId" : "10"
    }
    {
    "price" : "450",
    "pId" : "1"
    }
 */
//request update product
router.put("/updateproducts", (req, res) => {
  var pId = req.body.pId;
  var price = req.body.price;
  var sql = `UPDATE shop_db.product SET price = ${price} WHERE pId = ${pId}`;
  connection.query(sql,
    (error, results) => {
      console.log(results);
      if (error) {
        return res.send({ data: { err: true, msg: "Error occur" } });
      }
      return res.send({ data: { err: false, msg: `product ${pId} has been updated`} });
    }
  );
});
/***
 * TEST CASE FOR SEARCH ALL USER
 * METHOD GET
 * url : localhost:3030/searchuserall
 */
//request search user
router.get("/searchuserall", (req, res) => {
  connection.query(
    "SELECT * FROM shop_db.user ",
    (error, results, fields) => {
      if (error) {
        res.send({
          data: {
            err: true,
            msg: "Error occur",
          },
        });
        throw error;
      }
      console.log(results.length + " rows returned");
      return res.send({
        err: false,
        msg: `lists[${results.length} rows].`,
        data: results,
      });
    }
  );
});
/***
 * TEST CASE FOR SEARCH by USERNAME
 * METHOD GET
 * url : localhost:3030/searchuser/baby
 * url : localhost:3030/searchuser/payut
 */
//request search user by username
router.get("/searchuser/:searchuser/", (req, res) => {

  var username = req.params.searchuser.trim();
  var search = `SELECT * FROM shop_db.user WHERE username LIKE "%${username}%"`;
  connection.query(search, (error, results, fields) => {
    if (error) throw error;
    console.log(results.length + " rows returned");
    return res.send({
      err: false,
      msg: `lists[${results.length} rows].`,
      data: results,
    });
  });
});
/***
 * TEST CASE FOR INSERT USER
 * METHOD POST
 * url : localhost:3030/insertuser
 * body : json
 * {
    "ufname" : "Meow" ,
    "ulname" : "Dog",
    "username" : "meow",
    "password" : "meow",
    "email" : "none", 
    "age" : "2" ,
    "address" : "none",
    "role" : "admin"
  }
  {
    "ufname" : "John" ,
    "ulname" : "Smith",
    "username" : "john",
    "password" : "john1234",
    "email" : "john1234@ismyemail.com", 
    "age" : "33" ,
    "address" : "none",
    "role" : "user"
  }
 * 
 */
router.post("/insertuser",(req,res)=>{
    console.log(req.body);
    const ufname = req.body.ufname;
    const ulname = req.body.ulname;
    const username = req.body.username;
    const password = req.body.password;
    const role = req.body.role;
    if (!ufname || !ulname || !username || !password || !role) {
      return res.send({
        err: false,
        msg: "Please fill all firstname ,lastname, username, password, and role",
      });
    }
    const hash = bcrypt.hashSync(password, 12);
    let new_user = {
      ufname: req.body.ufname,
      ulname: req.body.ulname,
      username: req.body.username,
      password: hash,
      email: req.body.email,
      age: req.body.age,
      address: req.body.address,
      role: req.body.role,
    };
    connection.query(
      "INSERT INTO shop_db.user SET ?",
      new_user,
      (error, result) => {
        if (error) {
          console.log(error);
          if (error.errno == 1062) {
            return res.send({
              data: {
                err: true,
                msg: "This user name already used.",
              },
            });
          }
        } else {
          return res.send({
            data: {
              err: false,
              msg: `${username} has been added with ${role} role`,
            },
          });
        }
      }
    );
});
/***
 * TEST CASE FOR UPDATE USER
 * METHOD PUT
 * url : localhost:3030/updateuser
 * {
    "username" : "john",
    "role" : "admin"
    }
    {
    "username" : "meow",
    "role" : "user"
    }
 */
router.put("/updateuser",(req,res)=>{
  const username = req.body.username;
  const role = req.body.role;
  connection.query(
    "UPDATE shop_db.user SET role = ? WHERE username = ?",[role,username],
    (error, results, fields) => {
      if (error) {
        res.send({
          data: {
            err: true,
            msg: "Error occur",
          },
        });
        throw error;
      }
      if(results.affectedRows == 0){
        res.send({
          err: true,
          msg: `no user in database`,
        });
      }else{
        res.send({
          err: false,
          msg: `username: ${username} role change to ${role}`,
        });
      }
    }
  );
});
/***
 * TEST CASE FOR DELETE USER
 * METHOD DELETE
 * url : localhost:3030/deleteuser
 * {
    "username" : "meow"
    }
    {
    "username" : "misternobodyisnobydoyouknownobodyiswho"
    }
 */
router.delete("/deleteuser",(req,res)=>{
  const username = req.body.username;
  connection.query(
    `DELETE FROM shop_db.user WHERE username = ?`,
    username,
    (error, results) => {
      if (error) {
        return res.send({ data: { err: true, msg: "Error occur" } });
      }
      if(results.affectedRows == 0){

        return res.send({ data: { err: true, msg: `No username ${username} in database `} });
      }
      return res.send({ data: { err: false, msg: `username ${username} has been deleted`} });
    }
  );
})

/***
 *  Search and result page 
 */
//show search html
router.get("/search",(req,res)=>{
  return res.sendFile(path.join(__dirname + "/views/search.html"));
})
//show result page.
router.get("/result",(req,res)=>{
  res.sendFile(path.join(__dirname + "/views/result.html"));
})
//user request to search information. I just forward to result page. Query data will perform in result page.
router.get("/searchinfo/:name/:sortByPrice/:type",(req,res)=>{
  const name = req.params.name;
  const sortByPrice = req.params.sortByPrice;
  const type = req.params.type;
  console.log(name,sortByPrice,type);
  res.redirect(`/result?search=${name}&op1=${sortByPrice}&op2=${type}`)
});





var PORT = process.env.PORT;
app.listen(PORT, () => {
  console.log("Server listening at Port:" + PORT);
});
