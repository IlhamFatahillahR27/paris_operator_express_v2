var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var cors = require('cors');

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var microOutService = require('./services/GateOut/MicroOutService');
var emoneyInService = require('./services/GateIn/EmoneyInService');

var app = express();

// Initialize serial port
var EMONEY_GATE_IN = process.env.EMONEY_GATE_IN || false;
var appEnv = process.env.APP_ENV || 'local';

if (appEnv == 'production') {
  microOutService.initializeSerialPort();
  if (EMONEY_GATE_IN) {
    emoneyInService.initializeSerialPortEmoney();
  }
}


// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use(cors());

app.use('/', indexRouter, cors());
app.use('/users', usersRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
