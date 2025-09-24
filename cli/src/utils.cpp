#include "../include/utils.h"
#include <cstdlib>
#include <filesystem>
#include <fstream>
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
