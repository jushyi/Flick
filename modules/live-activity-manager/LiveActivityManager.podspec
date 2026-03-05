Pod::Spec.new do |s|
  s.name           = 'LiveActivityManager'
  s.version        = '0.0.1'
  s.summary        = 'Expo module for managing iOS Live Activities'
  s.description    = 'Native module for starting, ending, and diagnosing pinned snap Live Activities on the iOS lock screen'
  s.author         = 'Flick'
  s.homepage       = 'https://github.com/example'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
