#include "../include/graph_differencing_engine.h"

void graph_differencing_engine::gde_push(Authenticator &auth) {
  this->fetch_origin_commits(auth);
}

std::vector<std::string>
graph_differencing_engine::fetch_origin_commits(Authenticator &auth) {

  httplib::Client cli(API_BASE_URL, API_PORT); // server domain or IP
  // Custom headers
  httplib::Headers headers = {{AUTH_HEADER_KEY, auth.pullAuthToken()}};

  auto res = cli.Get("/transactions/commits", headers);

  std::cout << res->body << std::endl;

  return std::vector<std::string>();
}
