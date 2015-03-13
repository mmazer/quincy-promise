var gulp = require('gulp');
var mocha = require('gulp-mocha');
var jshint = require('gulp-jshint');
var stylish = require('jshint-stylish');
var jscs = require('gulp-jscs');
var rename = require('gulp-rename');
var rm = require('gulp-rm');
var concat = require('gulp-concat');
var uglify = require('gulp-uglify');
var pkg = require('./package');
var tasks = require('quincy/build/tasks');

gulp.task('lint', function() {
  return gulp.src(['lib/**/*.js'])
    .pipe(jshint())
    .pipe(jshint.reporter(stylish))
    .pipe(jscs());
});

gulp.task('test', function() {
  return gulp.src('test/spec/*.js', { read: false})
    .pipe(mocha());
});

gulp.task('module', tasks.configure(tasks.module, {
  prefix: 'quincy/',
  module: pkg.name
}));

gulp.task('bundle', ['module'], function() {
  return gulp.src(['target/*.js'])
    .pipe(concat(pkg.name + '.js'))
    .pipe(gulp.dest('bundle'));
});

gulp.task('build', ['bundle'], function() {
  return gulp.src(['bundle/*.js', '!bundle/*.min.js'])
  .pipe(uglify())
  .pipe(rename({suffix: '.min'}))
  .pipe(gulp.dest('bundle'));
});

gulp.task('clean', function() {
  return gulp.src(['*.tgz','target/**', 'bundle/*.js'], { read: false })
      .pipe( rm());
});

gulp.task('default', ['build']);
