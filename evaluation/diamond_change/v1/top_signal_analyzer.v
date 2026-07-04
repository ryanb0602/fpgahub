module top_signal_analyzer #(
    parameter DATA_W = 16,
    parameter ACC_W  = 40
)(
    input  wire                  clk,
    input  wire                  rst_n,
    input  wire                  data_valid,
    input  wire                  sync_reset,
    input  wire signed [DATA_W-1:0] data_in,
    output wire signed [ACC_W-1:0]  total_sum,
    output wire signed [ACC_W-1:0]  total_energy,
    output wire                  system_fault
);

    wire ovf_mean;
    wire ovf_energy;

    assign system_fault = ovf_mean | ovf_energy;

    mean_estimator #(
        .WIDTH(DATA_W),
        .ACC_W(ACC_W)
    ) u_path_mean (
        .clk          (clk),
        .rst_n        (rst_n),
        .sample_valid (data_valid),
        .window_reset (sync_reset),
        .sample_in    (data_in),
        .sum_out      (total_sum),
        .ovf_err      (ovf_mean)
    );

    energy_estimator #(
        .WIDTH(DATA_W),
        .ACC_W(ACC_W)
    ) u_path_energy (
        .clk          (clk),
        .rst_n        (rst_n),
        .sample_valid (data_valid),
        .window_reset (sync_reset),
        .sample_in    (data_in),
        .energy_out   (total_energy),
        .ovf_err      (ovf_energy)
    );

endmodule
