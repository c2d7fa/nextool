require "selenium-webdriver"

options = Selenium::WebDriver::Chrome::Options.new(args: ["--force-device-scale-factor=1"])
driver = Selenium::WebDriver.for :chrome, options: options
wait = Selenium::WebDriver::Wait.new(timeout: 20)

driver.get "http://localhost:1234/"

driver.find_element(:xpath, "//*[contains(@class, 'titleColumn')]").click
driver.find_element(:xpath, "//*[contains(text(), 'All')]").click
main = driver.find_element(:xpath, "//*[@id = 'root']")
driver.execute_script("arguments[0].style.maxWidth = '1000px'", main)
driver.execute_script("arguments[0].style.maxHeight = '450px'", main)
driver.execute_script("arguments[0].style.minHeight = 'auto'", main)
main.save_screenshot("screenshot.png")
