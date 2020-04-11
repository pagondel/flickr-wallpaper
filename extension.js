const Mainloop = imports.mainloop;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Self = imports.misc.extensionUtils.getCurrentExtension();
const Me = imports.misc.extensionUtils.getCurrentExtension();


let timeout, settings;

function getSettings() {
  let GioSSS = Gio.SettingsSchemaSource;
  let schemaSource = GioSSS.new_from_directory(
    Me.dir.get_child("schemas").get_path(),
    GioSSS.get_default(),
    false
  );
  let schemaObj = schemaSource.lookup(
    'org.gnome.shell.extensions.flickr-wallpaper', true);
  if (!schemaObj) {
    throw new Error('cannot find schemas');
  }
  return new Gio.Settings({ settings_schema : schemaObj });
}

function getUrl () {
  const date = new Date();
  date.setDate(date.getDate() -1 );

  const baseUrl = 'https://api.flickr.com/services/rest';
  const params = {
    per_page: 100,
    page: 1,
    date: date.toISOString().split('T')[0],
    method: 'flickr.interestingness.getList',
    api_key: '34b7baf652386050741a6ae2c439e54c',
    format: 'json',
    nojsoncallback: 1,
    extras: 'url_k',
  }

  const queryParams = Object.keys(params).map(key => `${key}=${params[key]}`).join('&');

  return `${baseUrl}?${queryParams}`;
}

function getPhotos () {
  const url = getUrl();
  const [ok, out, err, exit] = GLib.spawn_command_line_sync(`curl ${url}`);
  if (exit === 0) {
    const response = (JSON.parse(out.toString()));
    if(response.stat === 'ok') {
      const photos = response.photos.photo.filter((photo) => 'url_k' in photo);
      return photos;
    }
  }

  return [];
}

function getPhoto() {
  const photos = getPhotos();
  if (photos.length === 0) {
    return '';
  }

  const randomPhoto = photos[Math.floor(Math.random() * photos.length)];
  const path = Self.path + '/images/';
  const urlParts = randomPhoto.url_k.split('/');
  const fileName = `${path}${urlParts[urlParts.length - 1]}`;
  const [ok, out, err, exit] = GLib.spawn_command_line_sync(`curl --url ${randomPhoto.url_k} --output ${fileName}`);

  const arr = settings.get_strv('wallpapers');
  arr.push(fileName);
  settings.set_strv('wallpapers', arr);

  return fileName;
}

function clean() {
  const arr = settings.get_strv('wallpapers');
  if (arr.length > 10) {
    const photo = arr.shift();
    GLib.spawn_command_line_sync(`rm ${photo}`);
    settings.set_strv('wallpapers', arr);
  }
}

function changeWallpaper () {
  const photo = getPhoto();
  const background_setting = new Gio.Settings({ schema: 'org.gnome.desktop.background' });
  if (photo !== '' && background_setting.is_writable('picture-uri')) {
    if (background_setting.set_string('picture-uri', `file://${photo}`)) {
      Gio.Settings.sync();
    }
  }

  clean();

  return true
}

function init () {
  settings = getSettings();
}

function enable () {
  changeWallpaper();
  timeout = Mainloop.timeout_add_seconds(3600.0, changeWallpaper);
}

function disable () {
  Mainloop.source_remove(timeout);
}
