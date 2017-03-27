var gulp = require('gulp');
var del = require('del');
var filter = require('gulp-filter');
var shell = require('gulp-shell');
var clean = require('gulp-clean');
var typescript = require('gulp-typescript');
var htmlreplace = require('gulp-html-replace');
var runSequence = require('run-sequence');
var uglify = require('gulp-uglify');
var concat = require('gulp-concat');
var useref = require('gulp-useref');
var minifyCss = require('gulp-clean-css');
var imagemin = require('gulp-imagemin');
var rev = require('gulp-rev');
var inject = require('gulp-inject');
var revReplace = require('gulp-rev-replace');
var minifyHtml = require('gulp-minify-html');
const chmod = require('gulp-chmod');
var purify = require('gulp-purifycss');
var Builder = require('systemjs-builder');
var appBundleName = 'app.bundle.js';
var vendorBundleName = 'vendor.bundle.js';

var publish = process.argv[process.argv.indexOf("--target") + 1];

// Initiliaze Parameter
var tempSeedProject = './temp/SeedProject';
var SeedProjectSrcFolder = '../';
var publishSeedProject = publish + '/SeedProjectBuild';
var builder = new Builder('./', 'systemjs.config.js');


// This is main task for production use
gulp.task('default', ['build']);

gulp.task('build', function (done) {
    runSequence('clean', 'compile_ts', 'bundle', 'clean:tempTS', 'useref', 'jsPackages', 'minifyimage', 'static', 'applyversion',
        function () { done(); });
});

// clean the contents of the distribution directory
gulp.task('clean', ['cleanTemp', 'cleanTarget']);

gulp.task('cleanTarget', function () {
    var stream = del([publishSeedProject], { force: true });
    return stream;
});

gulp.task('cleanTemp', function () {
    var stream = del([tempSeedProject], { force: true });
    return stream;
});

gulp.task('clean:tempTS', function () {
    var stream = del.sync([tempSeedProject + '/app/**/*', '!' + tempSeedProject + '/app/' + appBundleName], { force: true });
    return stream;
});

//compiling all TypeScript files into js
gulp.task('compile_ts', ['copy:ts'], function () {
    return gulp
        .src([tempSeedProject + '/app/**/*.ts'])
        .pipe(typescript({
            "target": "es5",
            "module": "commonjs",
            "moduleResolution": "node",
            "sourceMap": true,
            "emitDecoratorMetadata": true,
            "experimentalDecorators": true,
            "removeComments": false,
            "noImplicitAny": false,
            "suppressImplicitAnyIndexErrors": false
        }))
        .pipe(gulp.dest(tempSeedProject + '/app'));
});

//copying all typescript files to temp
gulp.task('copy:ts', function () {
    return gulp.src([SeedProjectSrcFolder + '/app/**/*.ts'])
        .pipe(gulp.dest(tempSeedProject + '/app'));
});

//bundling packages to support all angular libraries
gulp.task('bundle', ['bundle:vendor', 'bundle:app']);

gulp.task('bundle:vendor', function () {
    return builder
        .buildStatic(tempSeedProject + '/app/vendor.js', tempSeedProject + '/scripts/' + vendorBundleName, { minify: true })
        .catch(function (err) {
            console.log('Vendor bundle error');
            console.log(err);
        });
});

gulp.task('bundle:app', function () {
    return builder
        .buildStatic(tempSeedProject + '/app/main.js', tempSeedProject + '/app/' + appBundleName, { minify: true })
        .catch(function (err) {
            console.log('App bundle error');
            console.log(err);
        });
});

//inject generated package script file to index.html
gulp.task('jsPackages', function () {
    return gulp.src(tempSeedProject + '/index.html')
        .pipe(inject(gulp.src([tempSeedProject + '/scripts/*.js', tempSeedProject + '/app/*.js',
                               '!' + tempSeedProject + '/scripts/libmain.js'], { read: false }), { relative: true }))
        .pipe(gulp.dest(tempSeedProject));
});

// Minify image
gulp.task('minifyimage', function () {
    return gulp.src(['./images/**/*.*'], { cwd: SeedProjectSrcFolder, base: SeedProjectSrcFolder })
        .pipe(imagemin())
        .pipe(gulp.dest(tempSeedProject));
});

// copy static assets - i.e. non TypeScript compiled source
gulp.task('static', function () {
    return gulp.src(['./bin/**/*.dll',
        './app/**/*.html',
        './config/**/*.config',
        './styles/fonts/*.*',
        './scripts/**/*.map',
        'Global.asax', 'web.config'], { cwd: SeedProjectSrcFolder, base: SeedProjectSrcFolder })
        .pipe(gulp.dest(tempSeedProject))
});

// copy UnRef for scripts files
gulp.task('useref', ['clean:packages'], function () {
    var cssFilter = filter("**/*.css", { restore: true });
    return gulp.src(['./index.html'], { cwd: SeedProjectSrcFolder, base: SeedProjectSrcFolder })
        .pipe(useref())     // Concatenate with gulp-useref
        .pipe(cssFilter)
        .pipe(minifyCss())
        .pipe(cssFilter.restore)
        .pipe(gulp.dest(tempSeedProject))
});

//delete additional unused scripts from the application.
gulp.task('clean:packages', function () {
    return gulp.src([tempSeedProject + '/' + appBundleName, tempSeedProject + '/' + vendorBundleName])
        .pipe(clean());
})

//apply version by uding revReplace
gulp.task('applyversion', ['revision'], function () {
    var manifest = gulp.src(publishSeedProject + '/rev-manifest.json');
    return gulp.src(['./**/*.*'], { cwd: publishSeedProject, base: publishSeedProject })
        .pipe(revReplace({ manifest: manifest }))
        .pipe(gulp.dest(publishSeedProject));
});

//excluding files from manifest file which is not declaring as version
gulp.task('revision', function () {
    var revExcludeFilter = filter(["**/*", "!styles/fonts/*.*", "!scripts/**/*.map", "!**/*.dll", "!**/*.html", "!**/*.config"], { restore: true });

    return gulp.src(['./**/*'], { cwd: tempSeedProject, base: tempSeedProject })
        .pipe(revExcludeFilter)
        .pipe(rev())
        .pipe(revExcludeFilter.restore)
        .pipe(chmod(666))
        .pipe(gulp.dest(publishSeedProject))  // write rev'd assets to build dir 
        .pipe(rev.manifest())
        .pipe(gulp.dest(publishSeedProject)) // write manifest to build dir
});
