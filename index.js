const path = require('path');

const mongoose = require('mongoose');
const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const MongoDBStore = require('connect-mongodb-session')(session);
const csrf = require('csurf');
const flash = require('connect-flash');
const multer = require('multer');
const helmet = require('helmet');
const compression = require('compression');

const errorController = require('./controllers/error');
const User = require('./Models/user');

const adminRoutes = require('./routes/admin');
const shopRoutes = require('./routes/shop');
const authRoutes = require('./routes/auth');

const MONGO_DB_URI = `mongodb+srv://${process.env.MONGO_USER}:${process.env.MONGO_PASS}@cluster0-nxj3i.mongodb.net/shop?retryWrites=true&w=majority`;

const app = express();
const store = new MongoDBStore({
	uri: MONGO_DB_URI,
	collection: 'sessions',
});
const csrfProtection = csrf();

app.set('view engine', 'ejs');
app.set('views', 'views');

const fileStorage = multer.diskStorage({
	destination: (req, file, cb) => {
		cb(null, 'images');
	},
	filename: (req, file, cb) => {
		cb(null, new Date().toDateString() + '-' + file.originalname);
	},
});

const fileFilter = (req, file, cb) => {
	if (
		file.mimetype === 'image/png' ||
		file.mimetype === 'image/jpg' ||
		file.mimetype === 'image/jpeg'
	) {
		cb(null, true);
	} else {
		cb(null, false);
	}
};

app.use(bodyParser.urlencoded({ extended: false }));
app.use(
	multer({ storage: fileStorage, fileFilter: fileFilter }).single('image')
);
app.use(express.static(path.join(__dirname, 'public')));
app.use('/images', express.static(path.join(__dirname, 'images')));
app.use(
	session({
		secret: 'thisIsMySecret',
		resave: false,
		saveUninitialized: false,
		store: store,
	})
);
app.use(csrfProtection);
app.use(flash());

app.use((req, res, next) => {
	if (!req.session.user) {
		return next();
	}
	User.findById(req.session.user._id)
		.then((user) => {
			if (!user) {
				return next();
			}
			req.user = user;
			next();
		})
		.catch((err) => {
			next(new Error(err));
		});
});

app.use((req, res, next) => {
	res.locals.isAuthenticated = req.session.isLoggedIn;
	res.locals.csrfToken = req.csrfToken();
	next();
});

app.use('/admin', adminRoutes);
app.use(shopRoutes);
app.use(authRoutes);

app.use(helmet());
app.use(compression());

app.use('/500', errorController.get500);
app.use(errorController.get404);

app.use((error, req, res, next) => {
	exports.get500 = (req, res, next) => {
		res.status(500).render('500', {
			pageTitle: 'Some error Occurred',
			path: '/500',
			isAuthenticated: req.session.isLoggedIn,
		});
	};
});

mongoose
	.connect(MONGO_DB_URI)
	.then(() => {
		app.listen(process.env.PORT || 3000);
		console.log('Connected!');
	})
	.catch((err) => {
		console.log(err);
	});
