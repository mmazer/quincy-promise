var gulp = require('gulp');
var mocha = require('gulp-mocha');
var jshint = require('gulp-jshint');
var stylish = require('jshint-stylish');
var jscs = require('gulp-jscs');
var rm = require('gulp-rm');

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

gulp.task('clean', function() {
  return gulp.src(['*.tgz'], { read: false })
      .pipe( rm());
});

gulp.task('default', ['test']);
