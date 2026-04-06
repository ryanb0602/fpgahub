
library IEEE;
use IEEE.STD_LOGIC_1164.ALL;

-- Uncomment the following library declaration if using
-- arithmetic functions with Signed or Unsigned values
use IEEE.NUMERIC_STD.ALL;

-- Uncomment the following library declaration if instantiating
-- any Xilinx leaf cells in this code.
--library UNISIM;
--use UNISIM.VComponents.all;

entity BNN_top is
    Port (
        clk     : in  std_logic;
        reset_n : in  std_logic;
        -- Physical Pins
        sclk    : in  std_logic;
        mosi    : in  std_logic;
        ss_n    : in  std_logic;
        miso    : out std_logic      
    );
end BNN_top;

architecture Structural of BNN_top is

    attribute MAX_FANOUT : integer;
    
    signal reset_n_buf : std_logic;
    signal reset_sync_reg : std_logic;
    attribute MAX_FANOUT of reset_n_buf : signal is 32;


    -- BRAM write signals
    signal w_bram_addr  : unsigned(9 downto 0);
    signal w_bram_data  : std_logic;
    signal w_bram_we    : std_logic;
    signal w_image_ready: std_logic;
    signal w_is_training: std_logic;
    signal w_target_label: std_logic_vector(7 downto 0);
    
    -- Reader Signals
    signal r_bram_addr  : unsigned(9 downto 0) := (others => '0');
    signal r_bram_out   : std_logic;
    
    --signals from BNN controller
    signal w_calc_enable_hidden : std_logic;
    signal w_calc_enable_output: std_logic;
    signal w_clear_output : std_logic;
    signal w_clear_hidden : std_logic;
    
    signal clear_hidden_tree : std_logic_vector(15 downto 0); -- One for each PE
    attribute DONT_TOUCH : string;
    attribute DONT_TOUCH of clear_hidden_tree : signal is "true";
    
    signal w_hidden_layer_output_addr : unsigned(8 downto 0);
    
    signal w_bnn_done : std_logic;
    
    signal r_hidden_output : std_logic;
    
    --signals for handling weight setting from comm controller to networks
    signal w_weight_we     : std_logic;
    signal w_weight_neuron : unsigned(9 downto 0);
    signal w_weight_addr   : unsigned(9 downto 0);
    signal w_weight_data   : std_logic_vector(7 downto 0);
    
    signal hidden_train_we : std_logic;
    signal output_train_we : std_logic;
    
    --argmax signals
    signal am_start_sig : std_logic;
    signal am_score_in : std_logic_vector(15 downto 0);
    signal am_out_score_addr : unsigned(3 downto 0);
    signal am_output : std_logic_vector(3 downto 0);
    signal am_done : std_logic;
    
    --backprop signals
    signal run_backprop : std_logic;
    signal backprop_done : std_logic;
    signal hidden_out_atv_addr_bp : unsigned(8 downto 0);
    signal ol_train_we_bp : std_logic;
    signal ol_train_ns_bp : unsigned(9 downto 0);
    signal ol_train_addr_bp : unsigned(9 downto 0);
    signal ol_train_reg_bp_w : std_logic_vector(7 downto 0);
    signal ol_train_out : std_logic_vector(7 downto 0);
    signal bp_image_buffer_addr  : unsigned(9 downto 0) := (others => '0');
    signal bp_hl_we : std_logic;
    signal bp_hl_ns : unsigned(9 downto 0);
    signal bp_hl_addr : unsigned(9 downto 0);
    signal bp_hl_w : std_logic_vector(7 downto 0);
    
    signal score_gap : std_logic_vector(15 downto 0);
    
    attribute MAX_FANOUT of run_backprop : signal is 32;
    
    signal hl_weight_out : std_logic_vector(7 downto 0);
    
    --training weights masters to implement multiplexing
    signal master_weight_we : std_logic;
    signal master_weight_ns : unsigned(9 downto 0);
    signal master_weight_addr : unsigned(9 downto 0);
    signal master_weight_write_reg : std_logic_vector(7 downto 0);
    signal master_image_buffer_addr : unsigned(9 downto 0) := (others => '0');
    signal master_hl_we : std_logic;
    signal master_hl_ns : unsigned(9 downto 0);
    signal master_hl_addr : unsigned(9 downto 0);
    signal master_hl_w : std_logic_vector(7 downto 0);
    signal master_pixel_addr_hl : unsigned(9 downto 0);
    
    attribute MAX_FANOUT of master_hl_ns : signal is 32;
    attribute MAX_FANOUT of master_hl_addr : signal is 32;
    attribute MAX_FANOUT of master_hl_we : signal is 32;
    
    signal calc_en_h_pipe : std_logic;
    signal calc_en_h_pipe2 : std_logic;
    signal calc_en_h_pipe3 : std_logic;
    attribute MAX_FANOUT of calc_en_h_pipe3 : signal is 64;
    
    signal pixel_broadcast_reg : std_logic;
    attribute MAX_FANOUT of pixel_broadcast_reg : signal is 32;
    
    signal hl_weight_out_reg : std_logic_vector(7 downto 0);
    signal ol_weight_out_reg : std_logic_vector(7 downto 0);
    signal r_hidden_output_reg : std_logic := '0';
    
    signal output_layer_addr_pipe : unsigned(8 downto 0);
    
    signal calc_en_o_pipe : std_logic := '0';
    
    signal clk_from_wiz : std_logic;
    
    signal w_dump_addr : unsigned(9 downto 0);
    signal w_dump_neuron : unsigned(9 downto 0);
    signal w_dump_weight_val : std_logic_vector(7 downto 0);
    signal weight_dumping_active : std_logic;
    
    attribute MAX_FANOUT of weight_dumping_active : signal is 32;
    
    signal weight_dump_buffer : std_logic_vector(7 downto 0);
    
    attribute MAX_FANOUT of weight_dump_buffer : signal is 32;
    
    component clk_wiz_0
    port (
        clk_in1  : in  std_logic;
        clk_out1 : out std_logic
    );
    end component;

begin

    
    --95mhz
    U_CLOCK_GEN : clk_wiz_0
        port map (
            clk_in1  => clk,
            clk_out1 => clk_from_wiz 
        );
    
    --set write enables when address is in range for each network
    hidden_train_we <= '1' when (w_weight_we = '1' and w_weight_neuron < 256) else '0';
    output_train_we <= '1' when (w_weight_we = '1' and w_weight_neuron >= 256) else '0';

    U_BNN_CONTROLLER : entity work.BNN_Controller
        port map(
            clk => clk_from_wiz,
            reset_n => reset_n_buf,
            image_ready => w_image_ready,
            is_training => w_is_training,
            
            pixel_addr => r_bram_addr,
            calc_enable_hidden => w_calc_enable_hidden,
            calc_enable_output => w_calc_enable_output,
            clear_hidden => w_clear_hidden,
            clear_output => w_clear_output,
            
            hidden_layer_output_addr => w_hidden_layer_output_addr,
            
            argmax_start => am_start_sig,
            argmax_done => am_done,
            argmax_output => am_output,
            
            backprop_start => run_backprop,
            backprop_done => backprop_done,
            
            bnn_done => w_bnn_done
        );
        
    U_HIDDEN_LAYER : entity work.hidden_layer
        port map(
            clk => clk_from_wiz,
            reset_n => reset_n_buf,
            clear_acc => clear_hidden_Tree,
            
            pixel_broadcast => pixel_broadcast_reg,
            pixel_addr => master_pixel_addr_hl,
            calc_enable => calc_en_h_pipe3,
            
            train_we         => master_hl_we,
            train_neuron_sel => master_hl_ns(8 downto 0),
            train_addr       => master_hl_addr,
            train_data_in    => master_hl_w,
            train_data_out => hl_weight_out,
            
            layer_output => r_hidden_output,
            layer_output_addr => w_hidden_layer_output_addr
        );
        
    U_OUTPUT_LAYER : entity work.output_layer
        port map(
            clk => clk_from_wiz,
            reset_n => reset_n_buf,
            clear_acc => w_clear_output,
            
            pixel_broadcast => r_hidden_output,
            pixel_addr => output_layer_addr_pipe,
            calc_enable => calc_en_o_pipe,
            
            train_we => master_weight_we,
            train_neuron_sel => master_weight_ns,
            train_addr => master_weight_addr,
            train_data_in    => master_weight_write_reg,
            train_data_out => ol_train_out,
            
            layer_out_signal => am_score_in,
            layer_out_addr => am_out_score_addr
            
        );
        
    U_ARGMAX : entity work.ARGMAX
        port map (
            clk => clk_from_wiz,
            reset_n => reset_n_buf,
            start => am_start_sig,
            
            score_in => am_score_in,
            score_addr => am_out_score_addr,
            
            predict => am_output,
            true_value => w_target_label,
            score_gap => score_gap,
            done => am_done
        );

    U_COMMS : entity work.CommsWrapper
        port map (
            clk         => clk_from_wiz,
            reset_n     => reset_n_buf,
            sclk        => sclk,
            mosi        => mosi,
            ss_n        => ss_n,
            miso        => miso,
            
            bram_addr   => w_bram_addr,
            bram_data   => w_bram_data,
            bram_we     => w_bram_we,
            
            image_ready => w_image_ready,
            is_training => w_is_training,
            target_label => w_target_label,
            
            bnn_done => w_bnn_done,
            bnn_prediction => am_output,
            
            weight_we => w_weight_we,
            weight_neuron => w_weight_neuron,
            weight_addr => w_weight_addr,
            weight_data => w_weight_data,
            
            weight_data_in => weight_dump_buffer,
            weight_addr_in => w_dump_addr,
            neuron_select_in => w_dump_neuron,
            weight_dump => weight_dumping_active
        );
        
    U_IMAGE_BUFFER : entity work.image_bram
        port map (
            clk      => clk_from_wiz,
            --SPI SIDE
            we       => w_bram_we,
            addr_w   => w_bram_addr,
            data_in  => w_bram_data,
            -- NN side
            addr_r   => master_image_buffer_addr,
            data_out => r_bram_out
        );
        
    U_BACKPROP : entity work.back_prop
        port map (
            clk => clk_from_wiz,
            reset_n => reset_n_buf,
            
            run => run_backprop,
            done => backprop_done,
            
            true_value => w_target_label,
            predicted => am_output,
            score_gap => score_gap,
            hidden_out_activation => r_hidden_output_reg,
            
            train_we_ol => ol_train_we_bp,
            train_neuron_sel_ol => ol_train_ns_bp,
            train_addr_ol => ol_train_addr_bp,
            train_data_write_reg_ol => ol_train_reg_bp_w,
            train_data_read_reg_ol => ol_weight_out_reg,
            
            pixel_read_addr => bp_image_buffer_addr,
            pixel_read_data => r_bram_out,
            
            train_we_hl => bp_hl_we,
            train_neuron_hl => bp_hl_ns,
            train_addr_hl => bp_hl_addr,
            train_data_w_hl => bp_hl_w,
            train_data_r_hl => hl_weight_out_reg
        );

    master_weight_we        <= ol_train_we_bp    when run_backprop = '1' else '0' when weight_dumping_active = '1' else w_weight_we;
    master_weight_ns        <= ol_train_ns_bp    when run_backprop = '1' else w_dump_neuron when weight_dumping_active = '1' else w_weight_neuron;
    master_weight_addr      <= ol_train_addr_bp  when run_backprop = '1' else w_weight_addr;
    master_weight_write_reg <= ol_train_reg_bp_w when run_backprop = '1' else w_weight_data;
    
    master_image_buffer_addr <= bp_image_buffer_addr when run_backprop = '1' else r_bram_addr;
    master_pixel_addr_hl <= bp_hl_addr when run_backprop = '1' else w_dump_addr when weight_dumping_active = '1' else r_bram_addr;
    
    master_hl_we <= bp_hl_we when run_backprop = '1' else '0' when weight_dumping_active = '1' else hidden_train_we;
    master_hl_ns <= bp_hl_ns when run_backprop = '1' else w_dump_neuron when weight_dumping_active = '1' else w_weight_neuron;
    master_hl_addr <= bp_hl_addr when run_backprop = '1' else w_dump_addr when weight_dumping_active = '1' else w_weight_addr;
    master_hl_w <= bp_hl_w when run_backprop = '1' else w_weight_data;
    
    w_dump_weight_val <= hl_weight_out when (w_dump_neuron < 256) else ol_train_out;
    
    process(clk_from_wiz)
    begin
        if rising_edge(clk_from_wiz) then
            calc_en_h_pipe <= w_calc_enable_hidden;
            calc_en_h_pipe2 <= calc_en_h_pipe;
            calc_en_h_pipe3 <= calc_en_h_pipe2;
            pixel_broadcast_reg <= r_bram_out; 
            for i in 0 to 15 loop
                clear_hidden_tree(i) <= w_clear_hidden;
            end loop;
            hl_weight_out_reg <= hl_weight_out;
            ol_weight_out_reg <= ol_train_out;
            r_hidden_output_reg <= r_hidden_output;
            reset_sync_reg <= reset_n;
            reset_n_buf <= reset_sync_reg;
            output_layer_addr_pipe <= w_hidden_layer_output_addr;
            calc_en_o_pipe <= w_calc_enable_output;
            
            weight_dump_buffer <= w_dump_weight_val;
        end if;
    end process;

end Structural;
