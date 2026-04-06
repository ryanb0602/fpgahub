#include <iostream>
#include <fstream>
#include <sstream>
#include <vector>

int main() {
  std::ifstream file("testproj2/CommsWrapper.vhd");
  std::ostringstream buffer;
  buffer << file.rdbuf();
  std::string moduleText = buffer.str();
  
  std::vector<std::string> dependencies;
  size_t current_pos = 0;
  std::string current_string = moduleText;
  std::string found_module;

  while (current_pos != std::string::npos) {
    current_pos = current_string.find("entity work.");
    if (current_pos != std::string::npos) {
      size_t name_end = current_string.find_first_of(" \n\r\t(", current_pos + 12);
      if (name_end != std::string::npos) {
        found_module = current_string.substr(current_pos + 12,
                                             name_end - (current_pos + 12));
        dependencies.push_back(found_module);
        current_pos = name_end;
        current_string = current_string.substr(current_pos);
      } else {
        found_module = current_string.substr(current_pos + 12);
        if (!found_module.empty()) dependencies.push_back(found_module);
        break;
      }
    } else {
      break;
    }
  }

  for (auto dep : dependencies) {
    std::cout << "DEP: '" << dep << "'\n";
    std::cout << "LENGTH: " << dep.length() << "\n";
  }
  return 0;
}
