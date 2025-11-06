#include "../include/utils.h"
#include "../include/sha256.h"
#include <cstdlib>
#include <filesystem>
#include <fstream>
#include <iomanip>
#include <sstream>
#include <sys/stat.h>

#include <unistd.h> // for getuid

std::string xdg_state_home_dir(std::string &app_name) {
  const char *xdg_state_home = std::getenv("XDG_STATE_HOME");
  std::string state_dir;

  if (xdg_state_home && *xdg_state_home) {
    state_dir = std::string(xdg_state_home);
  } else {
    const char *home = std::getenv("HOME");
    if (!home || !*home) {
      throw std::runtime_error("HOME environment variable is not set.");
    }

    state_dir = std::string(home) + "/.local/state";
  }

  state_dir += "/" + app_name;
  std::filesystem::create_directories(state_dir);
  return state_dir;
}

bool save_token(std::string &token, std::string &app_name) {
  std::string dir = xdg_state_home_dir(app_name);
  std::string file_path = dir + "/token";
  std::fstream file(file_path, std::ios::out | std::ios::trunc);
  if (!file.is_open()) {
    return false;
  }

  file << token;
  file.close();
  chmod(file_path.c_str(), S_IRUSR | S_IWUSR); // Set file permissions to 600
  return true;
}

bool load_token(std::string &token, std::string &app_name) {

  std::string dir = xdg_state_home_dir(app_name);
  std::string file_path = dir + "/token";
  std::ifstream file(file_path);
  if (!file.is_open()) {
    return false;
  }
  std::getline(file, token);
  file.close();
  if (token.empty()) {
    return false;
  }
  return true;
}

bool delete_token(std::string &app_name) {
  std::string dir = xdg_state_home_dir(app_name);
  std::string file_path = dir + "/token";
  if (std::filesystem::exists(file_path)) {
    std::filesystem::remove(file_path);
  }
  return true;
}

std::vector<std::string> list_files_recursive(const std::string &path) {
  std::vector<std::string> files;
  for (const auto &entry :
       std::filesystem::recursive_directory_iterator(path)) {
    if (entry.is_regular_file()) {
      files.push_back(entry.path().string());
    }
  }
  return files;
}

std::string hashFile(const std::string &path) {
  SHA256 sha;
  std::ifstream file(path, std::ios::binary);
  if (!file)
    return "";

  char buffer[4096];
  while (file.read(buffer, sizeof(buffer)))
    sha.update(reinterpret_cast<uint8_t *>(buffer), file.gcount());
  sha.update(reinterpret_cast<uint8_t *>(buffer), file.gcount());

  return sha.final();
}

std::string int_to_hex(int num) {
  std::stringstream ss;
  ss << std::hex << std::setw(2) << std::setfill('0') << (num & 0xFF);
  return ss.str();
}

std::vector<std::string> parse_string_array(const std::string &input) {
  std::vector<std::string> entries;

  // Find the start and end of the array
  size_t start = input.find('[');
  size_t end = input.find(']');

  if (start != std::string::npos && end != std::string::npos && end > start) {
    std::string arrayContent = input.substr(start + 1, end - start - 1);
    size_t pos = 0;
    while (pos < arrayContent.size()) {
      size_t quoteStart = arrayContent.find('"', pos);
      if (quoteStart == std::string::npos)
        break;
      size_t quoteEnd = arrayContent.find('"', quoteStart + 1);
      if (quoteEnd == std::string::npos)
        break;
      entries.push_back(
          arrayContent.substr(quoteStart + 1, quoteEnd - quoteStart - 1));
      pos = quoteEnd + 1;
    }
  }

  return entries;
}
