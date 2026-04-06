#include <iostream>
#include <fstream>
#include <sstream>

int main() {
  std::ifstream file("testproj2/SPI.vhd");
  std::ostringstream buffer;
  buffer << file.rdbuf();
  std::string fileContent = buffer.str();
  
  size_t module_start = fileContent.find("entity ");
  std::string module_text = fileContent.substr(module_start);
  size_t module_text_name_end = module_text.find(" ", 7);
  std::string module_name = module_text.substr(7, module_text_name_end - 7);
  
  std::cout << "NAME: '" << module_name << "'\n";
  std::cout << "LENGTH: " << module_name.length() << "\n";
  return 0;
}
