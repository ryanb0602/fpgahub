library IEEE;
use IEEE.STD_LOGIC_1164.ALL;
use IEEE.numeric_std.ALL;

-- Uncomment the following library declaration if using
-- arithmetic functions with Signed or Unsigned values
--use IEEE.NUMERIC_STD.ALL;

-- Uncomment the following library declaration if instantiating
-- any Xilinx leaf cells in this code.
--library UNISIM;
--use UNISIM.VComponents.all;

entity SPI is
    Port (
        -- Global Signals
        clk : in  std_logic;    -- High-speed system clock (e.g. 50MHz/100MHz)
        reset_n : in  std_logic;    -- Active low reset

        -- Physical SPI Interface
        sclk : in  std_logic;    -- SPI Clock
        mosi : in  std_logic;    -- Master Out Slave In
        ss_n : in  std_logic;    -- Slave Select (Active Low)
        miso : out std_logic;    -- Master In Slave Out (for predictions)
        
        -- Internal Logic Interface
        byte_data_o  : out std_logic_vector(7 downto 0);
        byte_ready_o : out std_logic;
        
        tx_data_i    : in  std_logic_vector(7 downto 0);
        tx_load_en : in std_logic
    );
end SPI;

architecture RTL of SPI is

    -- 1. Synchronization Shift Registers (3-stage for edge detection)
    signal sclk_sync : std_logic_vector(2 downto 0) := (others => '0');
    signal ss_n_sync : std_logic_vector(2 downto 0) := (others => '1');
    signal mosi_sync : std_logic_vector(1 downto 0) := (others => '0');

    -- 2. Data Shift Registers
    signal mosi_shift_reg : std_logic_vector(7 downto 0) := (others => '0');
    signal miso_shift_reg : std_logic_vector(7 downto 0) := (others => '0');
    
    -- 3. Control Signals
    signal bit_counter       : unsigned(2 downto 0) := "000";
    signal sclk_rising_edge  : std_logic;
    signal sclk_falling_edge : std_logic;
    
    signal miso_counter : unsigned(2 downto 0);
    signal temp_reg_miso : std_logic_vector(7 downto 0) := (others => '0');

begin

    ---------------------------------------------------------------------------
    -- PART 1: SYNCHRONIZATION (Double-Flopping)
    ---------------------------------------------------------------------------
    -- This samples external signals into the internal 'clk' domain.
    process(clk, reset_n)
    begin
        if reset_n = '0' then
            sclk_sync <= (others => '0');
            ss_n_sync <= (others => '1');
            mosi_sync <= (others => '0');
        elsif rising_edge(clk) then
            sclk_sync <= sclk_sync(1 downto 0) & sclk;
            ss_n_sync <= ss_n_sync(1 downto 0) & ss_n;
            mosi_sync <= mosi_sync(0) & mosi;
        end if;
    end process;

    -- Edge detection logic using the synchronized samples
    sclk_rising_edge  <= '1' when (sclk_sync(2 downto 1) = "01") else '0';
    sclk_falling_edge <= '1' when (sclk_sync(2 downto 1) = "10") else '0';


    ---------------------------------------------------------------------------
    -- PART 2: MOSI (RECEIVING DATA)
    ---------------------------------------------------------------------------
    process(clk) -- Remove reset_n from sensitivity, handle internally
    begin
        if rising_edge(clk) then
            byte_ready_o <= '0'; -- Absolute default: Always low unless bit 7 hits

            if ss_n = '1' then -- Use RAW physical pin for instant reset
                bit_counter <= "000";
                mosi_shift_reg <= (others => '0');
            elsif sclk_rising_edge = '1' then
                mosi_shift_reg <= mosi_shift_reg(6 downto 0) & mosi_sync(1);
                
                if bit_counter = "111" then
                    bit_counter  <= "000";
                    byte_ready_o <= '1'; -- Pure 1-cycle pulse
                    byte_data_o  <= mosi_shift_reg(6 downto 0) & mosi_sync(1);
                else
                    bit_counter <= bit_counter + 1;
                end if;
            end if;
        end if;
    end process;


    ---------------------------------------------------------------------------
    -- PART 3: MISO (SENDING DATA)
    ---------------------------------------------------------------------------
    -- MISO typically changes on the FALLING edge so the Master samples it 
    -- safely on the next RISING edge.
    process(clk)
    begin
        if rising_edge(clk) then
            if ss_n_sync(1) = '1' then
                miso <= 'Z';
                miso_shift_reg <= tx_data_i;
                miso_counter   <= (others => '0');
            else
            
                if tx_load_en = '1' then
                    temp_reg_miso <= tx_data_i;
                end if;
                
                -- NEW: Allow mid-transaction reload
                if sclk_falling_edge = '1' then
                    if miso_counter = "111" then
                        miso_shift_reg <= temp_reg_miso;
                        miso_counter   <= "000";
                    else
                        miso_shift_reg <= miso_shift_reg(6 downto 0) & '0';
                        miso_counter   <= miso_counter + 1;
                    end if;
                end if;
                miso <= miso_shift_reg(7); 
            end if;
        end if;
    end process;

end RTL;
