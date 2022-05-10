require "selenium-webdriver"

options = Selenium::WebDriver::Chrome::Options.new(args: ["--force-device-scale-factor=1"])
driver = Selenium::WebDriver.for :chrome, options: options
wait = Selenium::WebDriver::Wait.new(timeout: 20)

driver.get "http://localhost:3000/"

date = Time.now.strftime("%m/%d/%Y")

driver.find_element(:xpath, "//*[contains(text(), 'Task 1')]").click
driver.find_element(:xpath, "//*[contains(text(), 'Planned')]/following::input[@type = 'date']").send_keys(date)

driver.find_element(:xpath, "//*[contains(text(), 'Actions')]").click
main = driver.find_element(:xpath, "//*[@id = 'root']")
driver.execute_script("arguments[0].style.maxWidth = '1000px'", main)
driver.execute_script("arguments[0].style.maxHeight = '550px'", main)
driver.execute_script("arguments[0].style.minHeight = 'auto'", main)
main.save_screenshot("screenshot.png")
